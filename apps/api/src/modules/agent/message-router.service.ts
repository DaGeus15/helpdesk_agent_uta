import { Injectable, Logger } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { AgentService } from './agent.service';
import type { IncomingMessage } from './incoming-message';
import { SummaryService } from './summary.service';

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);

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
      return null;
    }

    const result = await this.agent.handle(current, msg.text);
    const { output, usage, blockedByGuard } = result;

    await this.conversations.addMessage({
      conversationId: current.id,
      role: 'assistant',
      content: output.reply,
      source: 'text',
      intent: output.intent,
      leadState: output.lead_state,
      flaggedInjection: output.injection_detected,
      blockedByGuard,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      latencyMs: usage.latencyMs,
    });

    await this.conversations.applyAgentResult(current.id, {
      leadState: output.lead_state,
      profileUpdates: output.profile_updates,
    });

    if (output.injection_detected) {
      await this.conversations.incrementInjectionAttempts(current.id);
    }

    if (output.lead_state === 'frustrado') {
      await this.conversations.pause(current.id, 'frustration');
    } else if (
      output.handover_requested ||
      output.intent === 'solicitud_humano'
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
}
