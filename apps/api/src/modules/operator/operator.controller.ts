import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { OperatorAuthGuard } from '../auth/operator-auth.guard';
import { CatalogSyncService } from '../catalog-sync/catalog-sync.service';
import { OperatorService } from './operator.service';

const sendMessageBodySchema = z.object({
  text: z.string().min(1).max(2000),
  clientId: z.string().min(1).max(128).optional(),
});

@Controller('operator')
@UseGuards(OperatorAuthGuard)
export class OperatorController {
  constructor(
    private readonly operator: OperatorService,
    private readonly catalogSync: CatalogSyncService,
  ) {}

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
        'Body inválido: se requiere { text } (1-2000) y opcionalmente clientId',
      );
    }
    return this.operator.sendOperatorMessage(
      id,
      parsed.data.text,
      parsed.data.clientId,
    );
  }

  @Get('conversations/:id/summary')
  async summary(@Param('id') id: string) {
    return this.operator.getSummary(id);
  }

  @Get('metrics')
  async metrics() {
    return this.operator.getMetrics();
  }

  @Post('catalog/sync')
  async syncCatalog() {
    return this.catalogSync.sync();
  }

  @Get('catalog/status')
  async catalogStatus() {
    return this.catalogSync.getStatus();
  }
}
