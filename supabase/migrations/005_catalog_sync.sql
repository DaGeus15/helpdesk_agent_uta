-- Catalog sync run history (idempotent). RLS: anon read-only, like other tables.

create table if not exists catalog_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  ok            boolean not null default false,
  total         int not null default 0,
  upserted      int not null default 0,
  deactivated   int not null default 0,
  error         text
);

create index if not exists catalog_sync_runs_started_at_idx
  on catalog_sync_runs (started_at desc);

alter table catalog_sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'catalog_sync_runs'
      and policyname = 'read_all'
  ) then
    create policy read_all on catalog_sync_runs for select to anon using (true);
  end if;
end $$;
