import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { GuardrailsService } from './guardrails.service';

@Module({
  imports: [CatalogModule],
  providers: [GuardrailsService],
  exports: [GuardrailsService],
})
export class GuardrailsModule {}
