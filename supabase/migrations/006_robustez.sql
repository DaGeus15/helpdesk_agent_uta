-- T20: robustez API — métricas SQL, contadores atómicos, delivery/idempotencia,
-- vista de último mensaje y realtime de handover_events (idempotente).

-- ---------------------------------------------------------------------------
-- messages: delivery_status + client_id (idempotencia del operador)
-- ---------------------------------------------------------------------------
alter table messages
  add column if not exists delivery_status text not null default 'sent';

alter table messages
  add column if not exists client_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_delivery_status_check'
  ) then
    alter table messages
      add constraint messages_delivery_status_check
      check (delivery_status in ('pending', 'sent', 'failed'));
  end if;
end $$;

create unique index if not exists messages_client_id_unique
  on messages (client_id)
  where client_id is not null;

-- ---------------------------------------------------------------------------
-- Vista: último mensaje por conversación (previews del panel)
-- ---------------------------------------------------------------------------
create or replace view conversation_last_message as
select distinct on (conversation_id)
  conversation_id,
  content,
  role,
  source,
  created_at
from messages
order by conversation_id, created_at desc;

grant select on conversation_last_message to anon;

-- ---------------------------------------------------------------------------
-- Contador atómico (solo message_count e injection_attempts)
-- ---------------------------------------------------------------------------
create or replace function increment_conversation_counter(
  conv_id uuid,
  field text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if field = 'message_count' then
    update conversations
    set message_count = message_count + 1,
        last_message_at = now()
    where id = conv_id;
  elsif field = 'injection_attempts' then
    update conversations
    set injection_attempts = injection_attempts + 1
    where id = conv_id;
  else
    raise exception 'increment_conversation_counter: field no permitido: %', field;
  end if;
end;
$$;

revoke all on function increment_conversation_counter(uuid, text) from public;
grant execute on function increment_conversation_counter(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Métricas del operador en un solo JSON (agregación en SQL)
-- ---------------------------------------------------------------------------
create or replace function operator_metrics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  since timestamptz := now() - interval '24 hours';
  result json;
begin
  select json_build_object(
    'active', (
      select count(*)::int
      from conversations
      where last_message_at >= since
    ),
    'byState', (
      select json_build_object(
        'interesado', count(*) filter (where lead_state = 'interesado'),
        'dudoso', count(*) filter (where lead_state = 'dudoso'),
        'frustrado', count(*) filter (where lead_state = 'frustrado'),
        'lead_caliente', count(*) filter (where lead_state = 'lead_caliente')
      )
      from conversations
    ),
    'hotLeads', (
      select count(*)::int
      from conversations
      where lead_state = 'lead_caliente'
    ),
    'handovers', (
      select count(*)::int
      from handover_events
      where type = 'paused'
    ),
    'injectionAttempts', (
      select coalesce(sum(injection_attempts), 0)::int
      from conversations
    ),
    'avgLatencyMs', (
      select coalesce(round(avg(latency_ms))::int, 0)
      from messages
      where role = 'assistant'
        and latency_ms is not null
    ),
    'tokensTotal', (
      select coalesce(sum(coalesce(tokens_in, 0) + coalesce(tokens_out, 0)), 0)::bigint
      from messages
      where role = 'assistant'
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function operator_metrics() from public;
grant execute on function operator_metrics() to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: handover_events (si aún no está en la publicación)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'handover_events'
  ) then
    alter publication supabase_realtime add table handover_events;
  end if;
end $$;
