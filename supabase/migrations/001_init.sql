-- CodeAndes Academy — esquema inicial (ver docs/ARCHITECTURE.md §3)
-- Ejecutar en Supabase: SQL Editor → pegar → Run.

create extension if not exists pgcrypto;

create table courses (
  id               text primary key,            -- 'python-fundamentos'
  name             text not null,
  level            text not null check (level in ('inicial','intermedio','avanzado')),
  duration_weeks   int  not null,
  hours_per_week   int  not null,
  price_usd        numeric(10,2) not null,
  modality         text not null,
  start_date       date not null,
  schedules        jsonb not null,              -- ["Lun-Mié 19:00-21:00", ...]
  syllabus         jsonb not null,              -- [{module:1,title,topics:[...]}]
  outcomes         text not null,
  active           boolean not null default true
);

create table promotions (
  id               text primary key,            -- 'PRONTO15'
  title            text not null,
  description      text not null,
  discount_percent int  not null check (discount_percent between 1 and 50),
  applies_to       text[],                      -- null = todos los cursos
  conditions       text not null,
  valid_until      date not null,
  active           boolean not null default true
);

create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  telegram_chat_id    bigint not null unique,
  telegram_username   text,
  display_name        text,
  lead_state          text not null default 'interesado'
                      check (lead_state in ('interesado','dudoso','frustrado','lead_caliente')),
  ai_paused           boolean not null default false,
  paused_reason       text,                      -- frustration | user_request | operator_takeover | operator_message
  profile             jsonb not null default '{}', -- {name, interest, level, availability, budget, goal, contact}
  summary             text not null default '',  -- resumen acumulado
  injection_attempts  int  not null default 0,
  message_count       int  not null default 0,
  last_message_at     timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  role              text not null check (role in ('user','assistant','operator')),
  content           text not null,
  source            text not null default 'text' check (source in ('text','voice')),
  intent            text,
  lead_state        text,
  flagged_injection boolean not null default false,
  blocked_by_guard  boolean not null default false,
  tokens_in         int,
  tokens_out        int,
  latency_ms        int,
  created_at        timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

create table handover_events (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  type             text not null check (type in ('paused','resumed')),
  reason           text not null,  -- frustration | user_request | operator_takeover | operator_message | operator_release
  created_at       timestamptz not null default now()
);

-- Realtime para el dashboard
alter publication supabase_realtime add table conversations, messages, handover_events;

-- RLS: el dashboard (anon key) solo lee; toda escritura pasa por la API (service role)
alter table courses enable row level security;
alter table promotions enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table handover_events enable row level security;
create policy read_all on courses        for select to anon using (true);
create policy read_all on promotions     for select to anon using (true);
create policy read_all on conversations  for select to anon using (true);
create policy read_all on messages       for select to anon using (true);
create policy read_all on handover_events for select to anon using (true);
