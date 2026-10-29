import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../config/env.schema';
import { SUPABASE_CLIENT } from './supabase.constants';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SupabaseClient =>
        createClient(
          config.get('SUPABASE_URL', { infer: true }),
          config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
        ),
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
