import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import type {
  Conversation,
  LeadProfile,
  LeadState,
  Message,
  MessageRole,
  MessageSource,
} from './conversations.types';

export interface UpsertTelegramChatInput {
  chatId: number;
  username?: string | null;
  displayName?: string | null;
}

export interface AddMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  source?: MessageSource;
  intent?: string | null;
  leadState?: string | null;
  flaggedInjection?: boolean;
  blockedByGuard?: boolean;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
}

export interface ApplyAgentResultInput {
  leadState: LeadState;
  profileUpdates: Partial<LeadProfile>;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async upsertByTelegramChat(
    input: UpsertTelegramChatInput,
  ): Promise<Conversation> {
    const { data: existing, error: findError } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('telegram_chat_id', input.chatId)
      .maybeSingle();

    if (findError) {
      throw new Error(
        `Failed to find conversation by telegram chat: ${findError.message}`,
      );
    }

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (input.username !== undefined) {
        patch.telegram_username = input.username ?? null;
      }
      if (input.displayName !== undefined) {
        patch.display_name = input.displayName ?? null;
      }

      if (Object.keys(patch).length === 0) {
        return mapConversation(existing);
      }

      const { data, error } = await this.supabase
        .from('conversations')
        .update(patch)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update conversation: ${error.message}`);
      }
      return mapConversation(data);
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        telegram_chat_id: input.chatId,
        telegram_username: input.username ?? null,
        display_name: input.displayName ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
    return mapConversation(data);
  }

  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find conversation: ${error.message}`);
    }
    return data ? mapConversation(data) : null;
  }

  async addMessage(input: AddMessageInput): Promise<Message> {
    const conversation = await this.requireById(input.conversationId);

    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
        source: input.source ?? 'text',
        intent: input.intent ?? null,
        lead_state: input.leadState ?? null,
        flagged_injection: input.flaggedInjection ?? false,
        blocked_by_guard: input.blockedByGuard ?? false,
        tokens_in: input.tokensIn ?? null,
        tokens_out: input.tokensOut ?? null,
        latency_ms: input.latencyMs ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to insert message: ${error.message}`);
    }

    const { error: updateError } = await this.supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: conversation.message_count + 1,
      })
      .eq('id', input.conversationId);

    if (updateError) {
      this.logger.error(
        `Message saved but failed to bump conversation counters: ${updateError.message}`,
      );
    }

    return mapMessage(data);
  }

  async getRecentMessages(
    conversationId: string,
    limit: number,
  ): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load recent messages: ${error.message}`);
    }

    return (data ?? []).map(mapMessage).reverse();
  }

  async applyAgentResult(
    id: string,
    input: ApplyAgentResultInput,
  ): Promise<Conversation> {
    const conversation = await this.requireById(id);
    const profile = mergeProfile(conversation.profile, input.profileUpdates);

    const { data, error } = await this.supabase
      .from('conversations')
      .update({
        lead_state: input.leadState,
        profile,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to apply agent result: ${error.message}`);
    }
    return mapConversation(data);
  }

  async incrementInjectionAttempts(id: string): Promise<void> {
    const conversation = await this.requireById(id);
    const { error } = await this.supabase
      .from('conversations')
      .update({ injection_attempts: conversation.injection_attempts + 1 })
      .eq('id', id);

    if (error) {
      throw new Error(
        `Failed to increment injection attempts: ${error.message}`,
      );
    }
  }

  async updateSummary(id: string, summary: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({ summary })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update summary: ${error.message}`);
    }
  }

  async pause(id: string, reason: string): Promise<Conversation> {
    const conversation = await this.requireById(id);
    if (conversation.ai_paused) {
      return conversation;
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .update({ ai_paused: true, paused_reason: reason })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to pause conversation: ${error.message}`);
    }

    const { error: eventError } = await this.supabase
      .from('handover_events')
      .insert({
        conversation_id: id,
        type: 'paused',
        reason,
      });

    if (eventError) {
      this.logger.error(
        `Paused conversation but failed to insert handover event: ${eventError.message}`,
      );
    }

    return mapConversation(data);
  }

  async resume(id: string, reason: string): Promise<Conversation> {
    const conversation = await this.requireById(id);
    if (!conversation.ai_paused) {
      return conversation;
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .update({ ai_paused: false, paused_reason: null })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to resume conversation: ${error.message}`);
    }

    const { error: eventError } = await this.supabase
      .from('handover_events')
      .insert({
        conversation_id: id,
        type: 'resumed',
        reason,
      });

    if (eventError) {
      this.logger.error(
        `Resumed conversation but failed to insert handover event: ${eventError.message}`,
      );
    }

    return mapConversation(data);
  }

  private async requireById(id: string): Promise<Conversation> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }
}

function mergeProfile(
  current: LeadProfile,
  updates: Partial<LeadProfile>,
): LeadProfile {
  const next: LeadProfile = { ...current };
  for (const key of Object.keys(updates) as (keyof LeadProfile)[]) {
    const value = updates[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    telegram_chat_id: Number(row.telegram_chat_id),
    telegram_username:
      row.telegram_username == null ? null : String(row.telegram_username),
    display_name: row.display_name == null ? null : String(row.display_name),
    lead_state: row.lead_state as LeadState,
    ai_paused: Boolean(row.ai_paused),
    paused_reason: row.paused_reason == null ? null : String(row.paused_reason),
    profile: (row.profile as LeadProfile) ?? {},
    summary: row.summary == null ? '' : String(row.summary),
    injection_attempts: Number(row.injection_attempts ?? 0),
    message_count: Number(row.message_count ?? 0),
    last_message_at: String(row.last_message_at),
    created_at: String(row.created_at),
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    role: row.role as MessageRole,
    content: String(row.content),
    source: (row.source as MessageSource) ?? 'text',
    intent: row.intent == null ? null : String(row.intent),
    lead_state: row.lead_state == null ? null : String(row.lead_state),
    flagged_injection: Boolean(row.flagged_injection),
    blocked_by_guard: Boolean(row.blocked_by_guard),
    tokens_in: row.tokens_in == null ? null : Number(row.tokens_in),
    tokens_out: row.tokens_out == null ? null : Number(row.tokens_out),
    latency_ms: row.latency_ms == null ? null : Number(row.latency_ms),
    created_at: String(row.created_at),
  };
}
