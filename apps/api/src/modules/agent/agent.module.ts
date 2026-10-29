import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { LlmModule } from '../llm/llm.module';
import { AgentService } from './agent.service';
import { MessageRouterService } from './message-router.service';
import { SummaryService } from './summary.service';

@Module({
  imports: [ConversationsModule, CatalogModule, LlmModule],
  providers: [AgentService, SummaryService, MessageRouterService],
  exports: [AgentService, SummaryService, MessageRouterService],
})
export class AgentModule {}
