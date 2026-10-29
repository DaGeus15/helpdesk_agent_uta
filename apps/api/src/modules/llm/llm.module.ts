import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { LLM_PROVIDER } from './llm-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const providerName = config.get('LLM_PROVIDER', { infer: true });
        if (providerName === 'gemini') {
          return new GeminiProvider(
            config.get('GEMINI_API_KEY', { infer: true }),
            config.get('GEMINI_MODEL', { infer: true }),
          );
        }
        throw new Error(
          `Unsupported LLM_PROVIDER="${String(providerName)}". Supported: gemini`,
        );
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
