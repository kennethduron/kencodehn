-- M2A readiness: resumable migration metadata, atomic row commits, and final notification inbox scope.
create table public.migration_checkpoints (
  source_system text not null,
  source_collection text not null,
  batch integer not null check (batch > 0),
  last_source_id text,
  processed_count integer not null check (processed_count >= 0),
  checksum text not null check (length(checksum) = 64),
  status text not null check (status = 'completed'),
  completed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (source_system, source_collection, batch)
);

alter table public.migration_checkpoints enable row level security;
alter table public.migration_checkpoints force row level security;
revoke all on public.migration_checkpoints from public, anon, authenticated;
grant select, insert, update on public.migration_checkpoints to service_role;

create or replace function public.migration_commit_row(
  p_source_collection text,
  p_source_id text,
  p_target_table text,
  p_target_id text,
  p_checksum text,
  p_row jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing_map public.migration_id_map%rowtype;
  target_exists boolean;
begin
  if p_target_table not in (
    'profiles', 'leads', 'lead_notes', 'tasks', 'notifications', 'activity_logs',
    'email_logs', 'push_logs', 'device_tokens', 'admin_settings', 'reminder_events'
  ) then
    raise exception 'unsupported migration target table';
  end if;

  select * into existing_map
  from public.migration_id_map
  where source_system = 'firebase'
    and source_collection = p_source_collection
    and source_id = p_source_id
    and target_table = p_target_table;

  execute format('select exists(select 1 from public.%I where id::text = $1)', p_target_table)
    into target_exists using p_target_id;

  if found and existing_map.id is not null then
    if existing_map.target_id <> p_target_id or existing_map.checksum <> p_checksum or not target_exists then
      return 'conflict';
    end if;
    return 'idempotent';
  end if;
  if target_exists then
    return 'conflict';
  end if;

  execute format(
    'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
    p_target_table,
    p_target_table
  ) using p_row;

  insert into public.migration_id_map (
    source_system, source_collection, source_id, target_table, target_id, source_version, checksum
  ) values (
    'firebase', p_source_collection, p_source_id, p_target_table, p_target_id, 'firebase-v1', p_checksum
  );
  return 'inserted';
end;
$$;

revoke all on function public.migration_commit_row(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.migration_commit_row(text, text, text, text, text, jsonb) to service_role;

drop policy if exists notifications_read_scoped on public.notifications;
create policy notifications_read_scoped on public.notifications
for select to authenticated
using (
  private.current_profile_active()
  and (
    (private.current_profile_role() in ('owner', 'admin') and (recipient_id = auth.uid() or recipient_id is null))
    or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
  )
);

drop policy if exists notifications_update_scoped on public.notifications;
create policy notifications_update_scoped on public.notifications
for update to authenticated
using (
  private.current_profile_active()
  and (
    (private.current_profile_role() in ('owner', 'admin') and (recipient_id = auth.uid() or recipient_id is null))
    or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
  )
)
with check (
  private.current_profile_active()
  and (
    (private.current_profile_role() in ('owner', 'admin') and (recipient_id = auth.uid() or recipient_id is null))
    or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
  )
);

drop policy if exists notifications_delete_scoped on public.notifications;
create policy notifications_delete_scoped on public.notifications
for delete to authenticated
using (
  private.current_profile_active()
  and (
    (private.current_profile_role() in ('owner', 'admin') and (recipient_id = auth.uid() or recipient_id is null))
    or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
  )
);

comment on table public.migration_checkpoints is 'Operational M2B resume metadata only; contains no secrets or document bodies.';
comment on function public.migration_commit_row(text, text, text, text, text, jsonb) is 'Service-role-only atomic idempotent migration insert with conflict detection.';
