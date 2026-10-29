import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema, type Env } from './env.schema';

export type { Env };

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => envSchema.parse(config),
    }),
  ],
})
export class AppConfigModule {}
