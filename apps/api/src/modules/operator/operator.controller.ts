import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { OperatorService } from './operator.service';

const sendMessageBodySchema = z.object({
  text: z.string().min(1).max(2000),
});

@Controller('operator')
export class OperatorController {
  constructor(private readonly operator: OperatorService) {}

  @Post('conversations/:id/takeover')
  async takeover(@Param('id') id: string) {
    return this.operator.takeover(id);
  }

  @Post('conversations/:id/release')
  async release(@Param('id') id: string) {
    return this.operator.release(id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = sendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        'Body inválido: se requiere { text } con 1-2000 caracteres',
      );
    }
    return this.operator.sendOperatorMessage(id, parsed.data.text);
  }

  @Get('conversations/:id/summary')
  async summary(@Param('id') id: string) {
    return this.operator.getSummary(id);
  }

  @Get('metrics')
  async metrics() {
    return this.operator.getMetrics();
  }
}
