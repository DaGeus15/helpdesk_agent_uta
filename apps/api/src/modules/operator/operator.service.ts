import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SummaryService } from '../agent/summary.service';
import { ConversationsService } from '../conversations/conversations.service';
import type {
  Conversation,
  LeadState,
  Message,
} from '../conversations/conversations.types';
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
}

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly summary: SummaryService,
    private readonly telegram: TelegramService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async takeover(
    id: string,
  ): Promise<{ conversation: Conversation; summary: string }> {
    const conversation = await this.conversations.pause(
      id,
      'operator_takeover',
    );
    const summary = await this.summary.summarizeNow(id);
    return { conversation, summary };
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
  ): Promise<{ message: Message }> {
    const conversation = await this.requireConversation(id);

    if (!conversation.ai_paused) {
      await this.conversations.pause(id, 'operator_message');
    }

    try {
      await this.telegram.sendText(conversation.telegram_chat_id, text);
    } catch (error) {
      this.logger.error(
        `Operator message Telegram send failed for ${id}: ${String(error)}`,
      );
      throw new BadGatewayException(
        'No se pudo enviar el mensaje por Telegram. Intenta de nuevo.',
      );
    }

    const message = await this.conversations.addMessage({
      conversationId: id,
      role: 'operator',
      content: text,
      source: 'text',
    });

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
