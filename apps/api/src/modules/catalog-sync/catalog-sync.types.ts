export interface CatalogSyncResult {
  ok: boolean;
  total: number;
  upserted: number;
  deactivated: number;
  durationMs: number;
  error?: string;
}

export interface CatalogSyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  total: number;
  upserted: number;
  deactivated: number;
  error: string | null;
}

export interface CatalogSyncStatus {
  enabled: boolean;
  intervalHours: number;
  running: boolean;
  nextScheduledAt: string | null;
  lastRun: CatalogSyncRunRow | null;
}
