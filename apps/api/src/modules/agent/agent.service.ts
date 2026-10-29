import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { CatalogService } from '../catalog/catalog.service';
import type { Conversation, Message } from '../conversations/conversations.types';
import { ConversationsService } from '../conversations/conversations.service';
import {
  LLM_PROVIDER,
  type LlmChatMessage,
  type LlmProvider,
  type LlmUsage,
} from '../llm/llm-provider.interface';
import { AgentOutput, agentOutputJsonSchema } from './agent.schema';
import { SYSTEM_PROMPT } from './prompts/system-prompt';

export interface AgentResult {
  output: AgentOutput;
  usage: LlmUsage;
  blockedByGuard: boolean;
}

const SAFE_REPLY =
  'Disculpa, tuve un problema técnico 🙏 ¿Me repites tu última pregunta? Si prefieres, te paso con un asesor.';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly catalog: CatalogService,
    private readonly conversations: ConversationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async handle(
    conversation: Conversation,
    userText: string,
  ): Promise<AgentResult> {
    const windowSize = this.config.get('CONTEXT_WINDOW_MESSAGES', {
      infer: true,
    });

    const compactCatalog = await this.catalog.getCompactCatalog();
    const systemInstruction = `${SYSTEM_PROMPT}\n\n# Catálogo oficial\n${compactCatalog}`;

    const recent = await this.conversations.getRecentMessages(
      conversation.id,
      windowSize,
    );

    const history = toLlmMessages(recent, userText);
    const sanitized = sanitizeUserText(userText);
    const turnPayload = [
      `Perfil actual: ${JSON.stringify(conversation.profile ?? {})}`,
      conversation.summary?.trim()
        ? `Resumen acumulado: ${conversation.summary.trim()}`
        : null,
      `<mensaje_usuario>${sanitized}</mensaje_usuario>`,
    ]
      .filter(Boolean)
      .join('\n');

    const messages: LlmChatMessage[] = [
      ...history,
      { role: 'user', text: turnPayload },
    ];

    try {
      const { data, usage } = await this.llm.generateStructured<AgentOutput>({
        systemInstruction,
        messages,
        schema: AgentOutput,
        jsonSchema: agentOutputJsonSchema,
        temperature: 0.6,
      });

      // T3.1: guardrails.postCheck aquí

      return { output: data, usage, blockedByGuard: false };
    } catch (error) {
      this.logger.error(
        `LLM structured call failed for conversation ${conversation.id}: ${String(error)}`,
      );
      return {
        output: {
          reply: SAFE_REPLY,
          lead_state: conversation.lead_state,
          intent: 'otro',
          profile_updates: {},
          mentioned_course_ids: [],
          mentioned_promotion_ids: [],
          handover_requested: false,
          handover_reason: null,
          injection_detected: false,
        },
        usage: { tokensIn: 0, tokensOut: 0, latencyMs: 0 },
        blockedByGuard: false,
      };
    }
  }
}

function sanitizeUserText(text: string): string {
  return text
    .replace(/<\/?mensaje_usuario>/gi, '')
    .trim();
}

/**
 * Map DB messages to LLM turns. Skip the trailing user message if it already
 * matches the current userText (it was just persisted by the router).
 */
function toLlmMessages(
  recent: Message[],
  currentUserText: string,
): LlmChatMessage[] {
  let messages = recent;
  const last = recent[recent.length - 1];
  if (
    last &&
    last.role === 'user' &&
    last.content.trim() === currentUserText.trim()
  ) {
    messages = recent.slice(0, -1);
  }

  const mapped: LlmChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      mapped.push({ role: 'user', text: msg.content });
    } else if (msg.role === 'assistant') {
      mapped.push({ role: 'model', text: msg.content });
    } else if (msg.role === 'operator') {
      mapped.push({
        role: 'model',
        text: `[Asesor humano]: ${msg.content}`,
      });
    }
  }
  return mapped;
}
