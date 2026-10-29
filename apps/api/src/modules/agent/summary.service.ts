import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { ConversationsService } from '../conversations/conversations.service';
import {
  LLM_PROVIDER,
  type LlmProvider,
} from '../llm/llm-provider.interface';

const SUMMARY_SYSTEM = `Eres un asistente interno. Resume conversaciones de ventas de CodeAndes Academy en español, máximo 100 palabras, para que un asesor humano retome el chat en segundos.
Formato: texto plano SIN markdown ni asteriscos, 4-5 líneas que empiecen así:
Lead: quién es (solo datos confirmados).
Interés: cursos o temas.
Objeciones: dudas o resistencias (o "ninguna").
Estado: ánimo y temperatura comercial.
Siguiente paso: qué conviene hacer ahora.
"Andrea" es la asistente IA, no un humano; los mensajes marcados como [Asesor humano] son del equipo. Si un dato no se conoce, omítelo: nunca escribas "unknown". Sé factual.`;

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly conversations: ConversationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Fire-and-forget friendly: updates summary every N messages. */
  async maybeUpdate(conversationId: string): Promise<void> {
    const every = this.config.get('SUMMARY_EVERY_N_MESSAGES', { infer: true });
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      return;
    }
    if (conversation.message_count === 0) {
      return;
    }
    if (conversation.message_count % every !== 0) {
      return;
    }
    await this.summarizeNow(conversationId);
  }

  async summarizeNow(conversationId: string): Promise<string> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const windowSize = this.config.get('CONTEXT_WINDOW_MESSAGES', {
      infer: true,
    });
    const recent = await this.conversations.getRecentMessages(
      conversationId,
      windowSize,
    );

    const transcript = recent
      .map((m) => {
        const who =
          m.role === 'user'
            ? 'Usuario'
            : m.role === 'operator'
              ? 'Asesor humano'
              : 'Andrea';
        return `${who}: ${m.content}`;
      })
      .join('\n');

    const prompt = [
      `Resumen anterior:\n${conversation.summary?.trim() || '(vacío)'}`,
      `Perfil: ${JSON.stringify(conversation.profile ?? {})}`,
      `Estado actual: ${conversation.lead_state}`,
      `Mensajes recientes:\n${transcript || '(ninguno)'}`,
      'Escribe un resumen acumulado ≤ 120 palabras.',
    ].join('\n\n');

    try {
      const { text } = await this.llm.generateText(SUMMARY_SYSTEM, prompt);
      const summary = text.replace(/\*\*?/g, '').trim().slice(0, 800);
      await this.conversations.updateSummary(conversationId, summary);
      return summary;
    } catch (error) {
      this.logger.error(
        `Failed to summarize conversation ${conversationId}: ${String(error)}`,
      );
      throw error;
    }
  }
}
