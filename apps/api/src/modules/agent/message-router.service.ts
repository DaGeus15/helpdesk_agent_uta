import { Injectable, Logger } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { AgentService } from './agent.service';
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

    await this.conversations.addMessage({
      conversationId: current.id,
      role: 'assistant',
      content: output.reply,
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

    return output.reply;
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
