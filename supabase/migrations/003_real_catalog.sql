-- CTT-FISEI real catalog: extend courses for multi-tier prices and real fields.
-- Idempotent. Run before supabase/seed_ctt.sql.

-- Relax level (allow null; drop fictional check if present)
alter table courses alter column level drop not null;
alter table courses drop constraint if exists courses_level_check;

-- Relax duration fields (CTT uses total_hours instead)
alter table courses alter column duration_weeks drop not null;
alter table courses alter column hours_per_week drop not null;
alter table courses alter column start_date drop not null;

-- New / extended columns
alter table courses add column if not exists price_tiers jsonb not null default '[]'::jsonb;
alter table courses add column if not exists enrollment_start date;
alter table courses add column if not exists enrollment_end date;
alter table courses add column if not exists end_date date;
alter table courses add column if not exists location text;
alter table courses add column if not exists instructors text;
alter table courses add column if not exists prerequisites text;
alter table courses add column if not exists certificate text;
alter table courses add column if not exists source_url text;
alter table courses add column if not exists site_status text;
alter table courses add column if not exists total_hours int;
