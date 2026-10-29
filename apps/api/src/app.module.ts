import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { AgentModule } from './modules/agent/agent.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { LlmModule } from './modules/llm/llm.module';
import { OperatorModule } from './modules/operator/operator.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    AppConfigModule,
    SupabaseModule,
    CatalogModule,
    LlmModule,
    ConversationsModule,
    AgentModule,
    TelegramModule,
    AuthModule,
    OperatorModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
