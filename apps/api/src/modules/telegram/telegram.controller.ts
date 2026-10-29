import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Update } from 'grammy/types';
import type { Env } from '../../config/env.schema';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Update,
  ): Promise<{ ok: true }> {
    const expected = this.config.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    // Process update; Nest returns 200 as soon as this resolves.
    // Handlers enqueue heavy work per-chat so this stays fast.
    await this.telegram.handleUpdate(update);
    return { ok: true };
  }
}
