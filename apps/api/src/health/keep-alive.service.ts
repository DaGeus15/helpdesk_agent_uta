import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

const PING_INTERVAL_MS = 10 * 60 * 1000;

/**
 * El plan gratuito de Render duerme el servicio tras 15 min sin tráfico entrante.
 * Un ping periódico a la URL pública lo mantiene despierto para que el bot responda al instante.
 */
@Injectable()
export class KeepAliveService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(KeepAliveService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onApplicationBootstrap(): void {
    const publicUrl = this.config.get('PUBLIC_API_URL', { infer: true });
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production' || !publicUrl) {
      return;
    }
    const healthUrl = `${publicUrl.replace(/\/$/, '')}/health`;
    this.timer = setInterval(() => {
      fetch(healthUrl).catch((error: unknown) =>
        this.logger.warn(`Keep-alive ping failed: ${String(error)}`),
      );
    }, PING_INTERVAL_MS);
    this.logger.log(`Keep-alive ping every 10 min to ${healthUrl}`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
