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
  webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Update,
  ): { ok: true } {
    const expected = this.config.get('TELEGRAM_WEBHOOK_SECRET', {
      infer: true,
    });
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    // 200 inmediato; el update se procesa en segundo plano (cola por chat).
    void this.telegram.handleUpdate(update);
    return { ok: true };
  }
}
