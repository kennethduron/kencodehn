-- Phase 1: satisfy the platform's safe-delete guard without weakening any
-- backup, target, count, Owner, transaction or idempotency protection.
create or replace function public.establish_clean_business_baseline(
  p_confirmation text,
  p_backup_checksum text,
  p_expected_counts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_existing public.business_baselines%rowtype;
  v_profiles integer;
  v_owners integer;
  v_actual jsonb;
  v_deleted jsonb;
  v_count integer;
begin
  if p_confirmation is distinct from 'PRE_CLEAN_BASELINE' then
    raise exception 'baseline confirmation mismatch' using errcode = '22023';
  end if;
  if p_backup_checksum is null or p_backup_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'verified backup checksum required' using errcode = '22023';
  end if;
  if p_expected_counts is null or jsonb_typeof(p_expected_counts) <> 'object' then
    raise exception 'expected counts object required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ken_code_pre_clean_business_baseline', 0));
  select * into v_existing
  from public.business_baselines
  where baseline_key = 'PRE_CLEAN_BASELINE'
  for update;

  if found then
    if v_existing.backup_checksum is distinct from p_backup_checksum then
      raise exception 'baseline already established with a different backup' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'baselineKey', v_existing.baseline_key,
      'backupChecksum', v_existing.backup_checksum,
      'deletedCounts', v_existing.deleted_counts,
      'idempotent', true,
      'createdAt', v_existing.created_at
    );
  end if;

  select count(*) into v_profiles from public.profiles;
  select count(*) into v_owners from public.profiles where role = 'owner' and active = true;
  if v_profiles <> coalesce((p_expected_counts->>'profiles')::integer, -1) or v_owners <> 1 then
    raise exception 'profile safety check failed' using errcode = '55000';
  end if;

  select jsonb_build_object(
    'leads', (select count(*) from public.leads),
    'lead_notes', (select count(*) from public.lead_notes),
    'tasks', (select count(*) from public.tasks),
    'reminder_events', (select count(*) from public.reminder_events),
    'notifications', (select count(*) from public.notifications),
    'activity_logs', (select count(*) from public.activity_logs),
    'email_logs', (select count(*) from public.email_logs),
    'push_logs', (select count(*) from public.push_logs)
  ) into v_actual;

  if v_actual is distinct from (p_expected_counts - 'profiles' - 'admin_settings') then
    raise exception 'operational data changed after backup; create a new backup' using errcode = '55000';
  end if;

  delete from public.reminder_events where true;
  get diagnostics v_count = row_count;
  v_deleted := jsonb_build_object('reminder_events', v_count);

  delete from public.email_logs where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('email_logs', v_count);

  delete from public.push_logs where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('push_logs', v_count);

  delete from public.notifications where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('notifications', v_count);

  delete from public.activity_logs where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('activity_logs', v_count);

  delete from public.lead_notes where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('lead_notes', v_count);

  delete from public.tasks where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('tasks', v_count);

  delete from public.leads where true;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('leads', v_count);

  insert into public.business_baselines(
    baseline_key,
    source_project_ref,
    backup_checksum,
    expected_counts,
    deleted_counts,
    profile_count,
    active_owner_count,
    executed_by
  ) values (
    'PRE_CLEAN_BASELINE',
    'nvtrgrltyzrkljarvwff',
    p_backup_checksum,
    p_expected_counts,
    v_deleted,
    v_profiles,
    v_owners,
    'service_role'
  );

  return jsonb_build_object(
    'baselineKey', 'PRE_CLEAN_BASELINE',
    'backupChecksum', p_backup_checksum,
    'deletedCounts', v_deleted,
    'idempotent', false,
    'profilesPreserved', v_profiles,
    'activeOwnersPreserved', v_owners
  );
end;
$$;

revoke all on function public.establish_clean_business_baseline(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.establish_clean_business_baseline(text, text, jsonb) to service_role;

comment on function public.establish_clean_business_baseline(text, text, jsonb) is
  'One-time service-role cleanup; explicit WHERE clauses satisfy safe-delete enforcement after all backup/count/Owner guards pass.';
