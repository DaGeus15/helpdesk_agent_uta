import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SummaryService } from '../agent/summary.service';
import { ConversationsService } from '../conversations/conversations.service';
import type {
  Conversation,
  LeadState,
  Message,
} from '../conversations/conversations.types';
import {
  LLM_PROVIDER,
  type LlmProvider,
} from '../llm/llm-provider.interface';
import { GeminiProvider } from '../llm/providers/gemini.provider';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { TelegramService } from '../telegram/telegram.service';

export interface OperatorMetrics {
  active: number;
  byState: Record<LeadState, number>;
  hotLeads: number;
  handovers: number;
  injectionAttempts: number;
  avgLatencyMs: number;
  tokensTotal: number;
  llm: {
    fallbacks: number;
    rateLimited: number;
  };
}

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly summary: SummaryService,
    private readonly telegram: TelegramService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Optional() @Inject(LLM_PROVIDER) private readonly llm?: LlmProvider,
  ) {}

  async takeover(id: string): Promise<{
    conversation: Conversation;
    summary: string | null;
    warning?: string;
  }> {
    const conversation = await this.conversations.pause(
      id,
      'operator_takeover',
    );

    try {
      const summary = await this.summary.summarizeNow(id);
      return { conversation, summary };
    } catch (error) {
      this.logger.warn(
        `takeover summary failed for ${id} (pause OK): ${String(error)}`,
      );
      return {
        conversation,
        summary: null,
        warning:
          'La conversación quedó en control del operador, pero no se pudo generar el resumen automático.',
      };
    }
  }

  async release(id: string): Promise<{ conversation: Conversation }> {
    const conversation = await this.conversations.resume(
      id,
      'operator_release',
    );
    return { conversation };
  }

  async sendOperatorMessage(
    id: string,
    text: string,
    clientId?: string | null,
  ): Promise<{ message: Message }> {
    const conversation = await this.requireConversation(id);

    if (!conversation.ai_paused) {
      await this.conversations.pause(id, 'operator_message');
    }

    // Idempotencia: mismo clientId ya enviado → no reenviar ni duplicar.
    // Si quedó failed/pending, se reutiliza la fila y se reintenta Telegram.
    if (clientId) {
      const existing = await this.conversations.findByClientId(clientId);
      if (existing?.delivery_status === 'sent') {
        return { message: existing };
      }
      if (existing) {
        return this.deliverOperatorMessage(
          conversation.telegram_chat_id,
          existing,
          text,
        );
      }
    }

    const pending = await this.conversations.addMessage({
      conversationId: id,
      role: 'operator',
      content: text,
      source: 'text',
      deliveryStatus: 'pending',
      clientId: clientId ?? null,
    });

    if (pending.delivery_status === 'sent') {
      return { message: pending };
    }

    return this.deliverOperatorMessage(
      conversation.telegram_chat_id,
      pending,
      text,
    );
  }

  private async deliverOperatorMessage(
    telegramChatId: number,
    pending: Message,
    text: string,
  ): Promise<{ message: Message }> {
    try {
      await this.telegram.sendText(telegramChatId, text);
    } catch (error) {
      this.logger.error(
        `Operator message Telegram send failed for ${pending.conversation_id}: ${String(error)}`,
      );
      const failed = await this.conversations.updateDeliveryStatus(
        pending.id,
        'failed',
      );
      throw new BadGatewayException({
        message:
          'No se pudo enviar el mensaje por Telegram. Intenta de nuevo.',
        messageRecord: failed,
      });
    }

    const message = await this.conversations.updateDeliveryStatus(
      pending.id,
      'sent',
    );
    return { message };
  }

  async getSummary(id: string): Promise<{
    summary: string;
    profile: Conversation['profile'];
    lead_state: LeadState;
  }> {
    const conversation = await this.requireConversation(id);
    let summary = conversation.summary?.trim() ?? '';

    if (!summary) {
      summary = await this.summary.summarizeNow(id);
    }

    return {
      summary,
      profile: conversation.profile,
      lead_state: conversation.lead_state,
    };
  }

  async getMetrics(): Promise<OperatorMetrics> {
    const llmStats =
      this.llm instanceof GeminiProvider
        ? this.llm.getObservability()
        : { fallbacks: 0, rateLimited: 0 };

    const { data, error } = await this.supabase.rpc('operator_metrics');
    if (error) {
      this.logger.warn(
        `operator_metrics RPC failed, falling back to client aggregates: ${error.message}`,
      );
      const fallback = await this.getMetricsFallback();
      return { ...fallback, llm: llmStats };
    }

    const row = (data ?? {}) as Record<string, unknown>;
    const byStateRaw = (row.byState ?? {}) as Record<string, number>;

    return {
      active: Number(row.active ?? 0),
      byState: {
        interesado: Number(byStateRaw.interesado ?? 0),
        dudoso: Number(byStateRaw.dudoso ?? 0),
        frustrado: Number(byStateRaw.frustrado ?? 0),
        lead_caliente: Number(byStateRaw.lead_caliente ?? 0),
      },
      hotLeads: Number(row.hotLeads ?? 0),
      handovers: Number(row.handovers ?? 0),
      injectionAttempts: Number(row.injectionAttempts ?? 0),
      avgLatencyMs: Number(row.avgLatencyMs ?? 0),
      tokensTotal: Number(row.tokensTotal ?? 0),
      llm: llmStats,
    };
  }

  /** Fallback if migration 006 is not applied yet. */
  private async getMetricsFallback(): Promise<Omit<OperatorMetrics, 'llm'>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [conversationsRes, handoversRes, assistantRes] = await Promise.all([
      this.supabase
        .from('conversations')
        .select('lead_state, injection_attempts, last_message_at'),
      this.supabase
        .from('handover_events')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'paused'),
      this.supabase
        .from('messages')
        .select('tokens_in, tokens_out, latency_ms')
        .eq('role', 'assistant'),
    ]);

    if (conversationsRes.error) {
      throw new Error(
        `Failed to load conversations for metrics: ${conversationsRes.error.message}`,
      );
    }
    if (handoversRes.error) {
      throw new Error(
        `Failed to count handovers: ${handoversRes.error.message}`,
      );
    }
    if (assistantRes.error) {
      throw new Error(
        `Failed to load assistant messages for metrics: ${assistantRes.error.message}`,
      );
    }

    const rows = conversationsRes.data ?? [];
    const byState: Record<LeadState, number> = {
      interesado: 0,
      dudoso: 0,
      frustrado: 0,
      lead_caliente: 0,
    };

    let active = 0;
    let hotLeads = 0;
    let injectionAttempts = 0;

    for (const row of rows) {
      const state = row.lead_state as LeadState;
      if (state in byState) {
        byState[state] += 1;
      }
      if (state === 'lead_caliente') {
        hotLeads += 1;
      }
      injectionAttempts += Number(row.injection_attempts ?? 0);
      if (row.last_message_at && String(row.last_message_at) >= since) {
        active += 1;
      }
    }

    const assistantRows = assistantRes.data ?? [];
    let tokensTotal = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const row of assistantRows) {
      tokensTotal +=
        Number(row.tokens_in ?? 0) + Number(row.tokens_out ?? 0);
      if (row.latency_ms != null) {
        latencySum += Number(row.latency_ms);
        latencyCount += 1;
      }
    }

    return {
      active,
      byState,
      hotLeads,
      handovers: handoversRes.count ?? 0,
      injectionAttempts,
      avgLatencyMs:
        latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      tokensTotal,
    };
  }

  private async requireConversation(id: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }
}
