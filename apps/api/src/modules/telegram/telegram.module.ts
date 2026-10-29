import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { LlmModule } from '../llm/llm.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [AgentModule, LlmModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
