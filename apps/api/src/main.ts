import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/request-id.middleware';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.use(requestIdMiddleware);

  const origins = config
    .get('DASHBOARD_ORIGIN', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
