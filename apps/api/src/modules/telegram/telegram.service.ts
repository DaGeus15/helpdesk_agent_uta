import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, type Context } from 'grammy';
import type { Update } from 'grammy/types';
import type { Env } from '../../config/env.schema';
import { MessageRouterService } from '../agent/message-router.service';
import {
  LLM_PROVIDER,
  type LlmProvider,
} from '../llm/llm-provider.interface';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot!: Bot;
  private readonly chatQueues = new Map<number, Promise<void>>();
  private mode!: Env['TELEGRAM_MODE'];
  private token!: string;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly router: MessageRouterService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    this.token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.mode = this.config.get('TELEGRAM_MODE', { infer: true });
    this.bot = new Bot(this.token);
    this.registerHandlers();

    if (this.mode === 'polling') {
      try {
        await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      } catch (error) {
        this.logger.warn(`deleteWebhook failed: ${String(error)}`);
      }
      void this.bot.start({
        onStart: () => this.logger.log('Telegram bot started (polling)'),
      });
      return;
    }

    const publicUrl = this.config.get('PUBLIC_API_URL', { infer: true });
    const secret = this.config.get('TELEGRAM_WEBHOOK_SECRET', { infer: true });
    if (!publicUrl || !secret) {
      throw new Error(
        'PUBLIC_API_URL and TELEGRAM_WEBHOOK_SECRET are required in webhook mode',
      );
    }
    const webhookUrl = `${publicUrl.replace(/\/$/, '')}/telegram/webhook`;
    await this.bot.api.setWebhook(webhookUrl, { secret_token: secret });
    this.logger.log(`Telegram webhook set to ${webhookUrl}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mode === 'polling' && this.bot) {
      try {
        await this.bot.stop();
      } catch (error) {
        this.logger.warn(`bot.stop failed: ${String(error)}`);
      }
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    await this.bot.handleUpdate(update);
  }

  async sendText(chatId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, text);
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram message to ${chatId}: ${String(error)}`,
      );
      throw error;
    }
  }

  private registerHandlers(): void {
    this.bot.command('start', (ctx) => {
      this.enqueue(ctx.chat.id, () =>
        this.processIncoming(ctx, 'hola', 'text'),
      );
    });

    this.bot.on('message:text', (ctx) => {
      const text = ctx.message.text?.trim();
      if (!text) {
        return;
      }
      // /start is also message:text; command handler already covers it
      if (text.startsWith('/start')) {
        return;
      }
      this.enqueue(ctx.chat.id, () =>
        this.processIncoming(ctx, text, 'text'),
      );
    });

    this.bot.on('message:voice', (ctx) => {
      this.enqueue(ctx.chat.id, () => this.processVoice(ctx));
    });

    this.bot.on('message:audio', (ctx) => {
      this.enqueue(ctx.chat.id, () => this.processAudio(ctx));
    });

    this.bot.on('message', async (ctx) => {
      const msg = ctx.message;
      if (!msg) {
        return;
      }
      if (msg.text || msg.voice || msg.audio) {
        return;
      }
      this.enqueue(ctx.chat.id, async () => {
        await this.sendText(
          ctx.chat.id,
          'Por ahora solo puedo leer texto y notas de voz 🙂 ¿Me escribes o me mandas un audio?',
        );
      });
    });
  }

  private enqueue(chatId: number, task: () => Promise<void>): void {
    const prev = this.chatQueues.get(chatId) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch((error: unknown) => {
        this.logger.error(
          `Chat ${chatId} queue task failed: ${String(error)}`,
        );
      })
      .then(() => {
        if (this.chatQueues.get(chatId) === next) {
          this.chatQueues.delete(chatId);
        }
      });
    this.chatQueues.set(chatId, next);
  }

  private async processIncoming(
    ctx: Context,
    text: string,
    source: 'text' | 'voice',
  ): Promise<void> {
    const chat = ctx.chat;
    if (!chat) {
      return;
    }

    try {
      await ctx.api.sendChatAction(chat.id, 'typing');
    } catch (error) {
      this.logger.warn(`sendChatAction failed: ${String(error)}`);
    }

    const from = ctx.from;
    const displayName = [from?.first_name, from?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    try {
      const reply = await this.router.handleIncoming({
        chatId: chat.id,
        username: from?.username ?? null,
        displayName: displayName || null,
        text,
        source,
      });
      if (reply) {
        await this.sendText(chat.id, reply);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process message from chat ${chat.id}: ${String(error)}`,
      );
      await this.sendText(
        chat.id,
        'Disculpa, tuve un problema técnico 🙏 ¿Me lo repites en un momento?',
      );
    }
  }

  private async processVoice(ctx: Context): Promise<void> {
    const voice = ctx.message?.voice;
    if (!voice) {
      return;
    }
    try {
      const text = await this.transcribeFile(voice.file_id, 'audio/ogg');
      if (!text.trim()) {
        await this.sendText(
          ctx.chat!.id,
          'No pude entender el audio 🙈 ¿Me lo mandas otra vez o en texto?',
        );
        return;
      }
      await this.processIncoming(ctx, text, 'voice');
    } catch (error) {
      this.logger.error(`Voice transcription failed: ${String(error)}`);
      await this.sendText(
        ctx.chat!.id,
        'No pude transcribir tu nota de voz 🙏 ¿Me escribes el mensaje?',
      );
    }
  }

  private async processAudio(ctx: Context): Promise<void> {
    const audio = ctx.message?.audio;
    if (!audio) {
      return;
    }
    const mime = audio.mime_type || 'audio/mpeg';
    try {
      const text = await this.transcribeFile(audio.file_id, mime);
      if (!text.trim()) {
        await this.sendText(
          ctx.chat!.id,
          'No pude entender el audio 🙈 ¿Me lo mandas otra vez o en texto?',
        );
        return;
      }
      await this.processIncoming(ctx, text, 'voice');
    } catch (error) {
      this.logger.error(`Audio transcription failed: ${String(error)}`);
      await this.sendText(
        ctx.chat!.id,
        'No pude transcribir tu audio 🙏 ¿Me escribes el mensaje?',
      );
    }
  }

  private async transcribeFile(
    fileId: string,
    mimeType: string,
  ): Promise<string> {
    const file = await this.bot.api.getFile(fileId);
    if (!file.file_path) {
      throw new Error('Telegram getFile returned no file_path');
    }
    const url = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download Telegram file: HTTP ${response.status}`,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { text } = await this.llm.transcribeAudio(buffer, mimeType);
    return text;
  }
}
