import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogSyncService } from './catalog-sync.service';
import { CtttScraperService } from './cttt-scraper.service';

@Module({
  imports: [CatalogModule],
  providers: [CtttScraperService, CatalogSyncService],
  exports: [CatalogSyncService, CtttScraperService],
})
export class CatalogSyncModule {}
