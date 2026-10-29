import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type { Course } from '../catalog/catalog.types';
import { ConversationsService } from '../conversations/conversations.service';
import type { LeadProfile } from '../conversations/conversations.types';
import { EnrollmentFormService } from '../enrollment/enrollment-form.service';
import { AgentService } from './agent.service';
import type { AgentOutput } from './agent.schema';
import type { IncomingMessage } from './incoming-message';
import { SummaryService } from './summary.service';

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);
  private readonly lastHoldingAt = new Map<string, number>();

  constructor(
    private readonly conversations: ConversationsService,
    private readonly agent: AgentService,
    private readonly summary: SummaryService,
    private readonly catalog: CatalogService,
    private readonly enrollmentForms: EnrollmentFormService,
  ) {}

  /**
   * Persist incoming message, run agent if IA is active, return reply text (or null if paused).
   */
  async handleIncoming(msg: IncomingMessage): Promise<string | null> {
    const conversation = await this.conversations.upsertByTelegramChat({
      chatId: msg.chatId,
      username: msg.username,
      displayName: msg.displayName,
    });

    await this.conversations.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: msg.text,
      source: msg.source,
    });

    // Refresh after bumping message_count / in case of concurrent updates
    const current =
      (await this.conversations.findById(conversation.id)) ?? conversation;

    if (current.ai_paused) {
      this.logger.debug(
        `Conversation ${current.id} paused — skipping inference`,
      );
      return this.holdingReply(current.id);
    }

    const result = await this.agent.handle(current, msg.text);
    const { output, usage, blockedByGuard, flaggedInjection } = result;
    const injectionFlagged =
      flaggedInjection || output.injection_detected;

    const profileAfter: LeadProfile = {
      ...current.profile,
      ...output.profile_updates,
    };
    const reply = await this.appendEnrollmentLinkIfNeeded(
      current.id,
      output,
      profileAfter,
    );

    await this.conversations.addMessage({
      conversationId: current.id,
      role: 'assistant',
      content: reply,
      source: 'text',
      intent: output.intent,
      leadState: output.lead_state,
      flaggedInjection: injectionFlagged,
      blockedByGuard,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      latencyMs: usage.latencyMs,
    });

    await this.conversations.applyAgentResult(current.id, {
      leadState: output.lead_state,
      profileUpdates: output.profile_updates,
    });

    if (injectionFlagged) {
      await this.conversations.incrementInjectionAttempts(current.id);
    }

    if (output.lead_state === 'frustrado') {
      await this.conversations.pause(current.id, 'frustration');
    } else if (
      output.intent === 'solicitud_humano' ||
      // Ofrecer un asesor ante una manipulación no es pedir uno.
      (output.handover_requested && output.intent !== 'intento_manipulacion')
    ) {
      await this.conversations.pause(current.id, 'user_request');
    }

    void this.summary.maybeUpdate(current.id).catch((err: unknown) => {
      this.logger.warn(
        `Background summary update failed for ${current.id}: ${String(err)}`,
      );
    });

    return reply;
  }

  /**
   * Server-side enrollment link (never from the LLM). Appends a prefilled
   * Google Form URL when the lead is hot / asking to enroll.
   */
  private async appendEnrollmentLinkIfNeeded(
    conversationId: string,
    output: AgentOutput,
    profile: LeadProfile,
  ): Promise<string> {
    const wantsEnroll =
      output.intent === 'inscripcion' || output.lead_state === 'lead_caliente';
    if (!wantsEnroll) return output.reply;

    const course = await this.resolveEnrollmentCourse(output, profile);
    if (!course?.enrollment_form_url) return output.reply;

    const recent = await this.conversations.getRecentMessages(
      conversationId,
      12,
    );
    const recentAssistant = recent
      .filter((m) => m.role === 'assistant')
      .slice(-5);
    let url: string;
    try {
      url = await this.enrollmentForms.buildPrefilledUrl(
        course.enrollment_form_url,
        profile,
        { courseName: course.name },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to build prefilled URL for ${course.id}: ${String(err)}`,
      );
      url = course.enrollment_form_url;
    }

    // Se reenvía solo si el enlace cambió (p. ej. ahora sí lleva los datos del perfil).
    if (recentAssistant.some((m) => m.content.includes(url))) return output.reply;

    const prefilled = url !== course.enrollment_form_url;
    const block = prefilled
      ? `📝 Te dejé el formulario de inscripción de ${course.name} prellenado con tus datos; solo revisa y envía: ${url}`
      : `Formulario de inscripción de ${course.name}: ${url}`;

    const base = output.reply.trimEnd();
    const combined = `${base}\n\n${block}`;
    // Soft cap near Telegram / schema reply limit
    if (combined.length > 1800) {
      const room = 1800 - block.length - 2;
      if (room < 40) return block.slice(0, 1800);
      return `${base.slice(0, room).trimEnd()}\n\n${block}`;
    }
    return combined;
  }

  private async resolveEnrollmentCourse(
    output: AgentOutput,
    profile: LeadProfile,
  ): Promise<Course | null> {
    const mentioned = output.mentioned_course_ids?.[0];
    let course: Course | null = null;
    if (mentioned) course = await this.catalog.getCourseById(mentioned);
    if (!course && profile.interest) {
      course = await this.catalog.findCourseByInterest(profile.interest);
    }
    if (!course || course.status !== 'finalizado') return course;

    // Una edición finalizada no admite inscripción: se busca la vigente del mismo curso
    // (p. ej. "FUNDAMENTOS DE PYTHON 2" de 2025 → "Fundamentos de Python 2 – Certified…").
    const key = normalizeCourseName(course.name);
    const current = (await this.catalog.getCourses()).find(
      (c) => c.status !== 'finalizado' && normalizeCourseName(c.name).startsWith(key),
    );
    return current ?? null;
  }

  /**
   * Con la IA pausada no se infiere, pero el usuario nunca se queda en silencio:
   * si ningún asesor ha escrito en los últimos minutos, se envía (sin LLM) un aviso de espera,
   * como mucho uno cada HOLDING_COOLDOWN_MS.
   */
  private async holdingReply(conversationId: string): Promise<string | null> {
    const now = Date.now();
    const lastHolding = this.lastHoldingAt.get(conversationId) ?? 0;
    if (now - lastHolding < HOLDING_COOLDOWN_MS) {
      return null;
    }

    const recent = await this.conversations.getRecentMessages(conversationId, 10);
    const lastOperator = [...recent].reverse().find((m) => m.role === 'operator');
    if (
      lastOperator &&
      now - new Date(lastOperator.created_at).getTime() < OPERATOR_ACTIVE_MS
    ) {
      return null;
    }

    this.lastHoldingAt.set(conversationId, now);
    await this.conversations.addMessage({
      conversationId,
      role: 'assistant',
      content: HOLDING_MESSAGE,
      source: 'text',
      intent: 'espera_asesor',
    });
    return HOLDING_MESSAGE;
  }
}

const HOLDING_MESSAGE =
  '¡Recibido! 🙌 Un asesor del equipo de los Talleres CTT-FISEI ya está revisando tu conversación y te responde en unos minutos.';
const HOLDING_COOLDOWN_MS = 5 * 60 * 1000;
const OPERATOR_ACTIVE_MS = 3 * 60 * 1000;

function normalizeCourseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[–-]/)[0]
    .trim();
}
