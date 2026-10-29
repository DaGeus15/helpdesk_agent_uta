import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { TelegramModule } from '../telegram/telegram.module';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';

@Module({
  imports: [AuthModule, ConversationsModule, AgentModule, TelegramModule],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
