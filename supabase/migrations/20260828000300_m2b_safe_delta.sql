-- M2B application readiness: atomic, migration-owned delta updates with optimistic conflict detection.
create or replace function public.migration_commit_row_v2(
  p_source_collection text,
  p_source_id text,
  p_target_table text,
  p_target_id text,
  p_checksum text,
  p_row jsonb,
  p_allow_mapped_update boolean default false,
  p_previous_checksum text default null,
  p_expected_row jsonb default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing_map public.migration_id_map%rowtype;
  target_exists boolean;
  current_row jsonb;
  assignments text;
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
    and target_table = p_target_table
  for update;

  execute format('select exists(select 1 from public.%I where id::text = $1)', p_target_table)
    into target_exists using p_target_id;

  if existing_map.id is not null then
    if existing_map.target_id <> p_target_id or not target_exists then
      return 'conflict';
    end if;
    if existing_map.checksum = p_checksum then
      return 'idempotent';
    end if;
    if not p_allow_mapped_update
      or p_previous_checksum is null
      or existing_map.checksum <> p_previous_checksum
      or p_expected_row is null then
      return 'conflict';
    end if;

    execute format('select to_jsonb(target) from public.%I target where id::text = $1 for update', p_target_table)
      into current_row using p_target_id;
    if current_row is distinct from p_expected_row then
      return 'conflict';
    end if;

    select string_agg(format('%1$I = populated.%1$I', column_name), ', ' order by ordinal_position)
      into assignments
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_target_table
      and column_name in (select jsonb_object_keys(p_row))
      and is_generated = 'NEVER';
    if assignments is null then
      raise exception 'migration delta contains no writable columns';
    end if;

    execute format(
      'update public.%1$I target set %2$s from jsonb_populate_record(null::public.%1$I, $1) populated where target.id::text = $2',
      p_target_table,
      assignments
    ) using p_row, p_target_id;
    update public.migration_id_map
      set checksum = p_checksum, source_version = 'firebase-v2'
      where id = existing_map.id;
    return 'updated';
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

revoke all on function public.migration_commit_row_v2(text, text, text, text, text, jsonb, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.migration_commit_row_v2(text, text, text, text, text, jsonb, boolean, text, jsonb) to service_role;

comment on function public.migration_commit_row_v2(text, text, text, text, text, jsonb, boolean, text, jsonb)
is 'Service-role-only atomic insert/idempotency/delta writer. Delta updates require an immutable mapping plus an exact locked target snapshot.';
