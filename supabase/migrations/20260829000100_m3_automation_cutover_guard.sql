-- M3 pre-cutover safety: establish an auditable reminder baseline before any Supabase cron can deliver.
alter table public.admin_settings
  add column if not exists automation_cutover_at timestamptz,
  add column if not exists automation_baseline_completed_at timestamptz;

create or replace function public.baseline_reminders_for_cutover(p_cutover timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_existing_cutover timestamptz;
  v_inserted integer := 0;
begin
  if p_cutover is null then
    raise exception 'automation cutover timestamp is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ken_code_automation_cutover', 0));
  insert into public.admin_settings(id) values ('default') on conflict (id) do nothing;

  select automation_cutover_at
    into v_existing_cutover
    from public.admin_settings
    where id = 'default'
    for update;

  if v_existing_cutover is not null and v_existing_cutover is distinct from p_cutover then
    raise exception 'automation cutover timestamp is immutable' using errcode = '22023';
  end if;

  update public.admin_settings
    set automation_cutover_at = coalesce(automation_cutover_at, p_cutover)
    where id = 'default';

  with settings as (
    select * from public.admin_settings where id = 'default'
  ), windows as (
    select
      t.id as task_id,
      t.assigned_to as recipient_id,
      t.due_at,
      reminder_window.kind,
      reminder_window.scheduled_at
    from public.tasks t
    cross join settings s
    cross join lateral (values
      ('one_day'::public.reminder_kind, t.due_at - interval '1 day', s.task_reminder_one_day_enabled, t.reminder_one_day_sent_at),
      ('one_hour'::public.reminder_kind, t.due_at - interval '1 hour', s.task_reminder_one_hour_enabled, t.reminder_one_hour_sent_at),
      ('due'::public.reminder_kind, t.due_at, s.task_due_enabled, t.due_notification_sent_at),
      ('overdue'::public.reminder_kind, t.due_at, s.task_overdue_enabled, t.overdue_notified_at)
    ) as reminder_window(kind, scheduled_at, enabled, legacy_sent_at)
    where t.status in ('pending', 'in_progress', 'overdue')
      and t.assigned_to is not null
      and t.due_at is not null
      and reminder_window.enabled
      and reminder_window.legacy_sent_at is null
      and reminder_window.scheduled_at < p_cutover
  ), inserted as (
    insert into public.reminder_events(
      firebase_id,
      deterministic_key,
      task_id,
      recipient_id,
      kind,
      status,
      notification_status,
      email_status,
      push_status,
      completed_at,
      metadata,
      created_at,
      updated_at
    )
    select
      'supabase:' || encode(extensions.digest(w.task_id::text || '|' || w.kind::text || '|' || w.due_at::text, 'sha256'), 'hex'),
      encode(extensions.digest(w.task_id::text || '|' || w.kind::text || '|' || w.due_at::text, 'sha256'), 'hex'),
      w.task_id,
      w.recipient_id,
      w.kind,
      'completed',
      'skipped',
      'skipped',
      'skipped',
      p_cutover,
      jsonb_build_object(
        'reason', 'skipped_migration_baseline',
        'scheduled_at', w.scheduled_at,
        'automation_cutover_at', p_cutover
      ),
      p_cutover,
      p_cutover
    from windows w
    on conflict (deterministic_key) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  update public.admin_settings
    set automation_baseline_completed_at = coalesce(automation_baseline_completed_at, p_cutover)
    where id = 'default';

  return jsonb_build_object(
    'automation_cutover_at', p_cutover,
    'baseline_events_inserted', v_inserted,
    'reason', 'skipped_migration_baseline'
  );
end;
$$;

create or replace function public.enqueue_due_reminder_events(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_cutover timestamptz;
  v_baseline_completed timestamptz;
  inserted_count integer;
begin
  select automation_cutover_at, automation_baseline_completed_at
    into v_cutover, v_baseline_completed
    from public.admin_settings
    where id = 'default';

  if v_cutover is null or v_baseline_completed is null then
    raise exception 'automation migration baseline is not configured' using errcode = '55000';
  end if;

  with settings as (select * from public.admin_settings where id = 'default'),
  candidates as (
    select t.*,
      case
        when t.due_at < p_now - interval '10 minutes'
          and t.due_at >= v_cutover
          and t.overdue_notified_at is null
          and coalesce((select task_overdue_enabled from settings), true)
          then 'overdue'::public.reminder_kind
        when t.due_at <= p_now
          and t.due_at >= v_cutover
          and t.due_notification_sent_at is null
          and coalesce((select task_due_enabled from settings), true)
          then 'due'::public.reminder_kind
        when t.due_at - interval '1 hour' <= p_now
          and t.due_at - interval '1 hour' >= v_cutover
          and t.reminder_one_hour_sent_at is null
          and coalesce((select task_reminder_one_hour_enabled from settings), true)
          then 'one_hour'::public.reminder_kind
        when t.due_at - interval '1 day' <= p_now
          and t.due_at - interval '1 day' >= v_cutover
          and t.reminder_one_day_sent_at is null
          and coalesce((select task_reminder_one_day_enabled from settings), true)
          then 'one_day'::public.reminder_kind
        else null
      end as reminder_kind
    from public.tasks t
    where t.status in ('pending', 'in_progress', 'overdue')
      and t.assigned_to is not null
      and t.due_at is not null
      and t.due_at <= p_now + interval '1 day'
  ), inserted as (
    insert into public.reminder_events(firebase_id, deterministic_key, task_id, recipient_id, kind, status, metadata)
    select
      'supabase:' || encode(extensions.digest(c.id::text || '|' || c.reminder_kind::text || '|' || c.due_at::text, 'sha256'), 'hex'),
      encode(extensions.digest(c.id::text || '|' || c.reminder_kind::text || '|' || c.due_at::text, 'sha256'), 'hex'),
      c.id,
      c.assigned_to,
      c.reminder_kind,
      'pending',
      jsonb_build_object('due_at', c.due_at, 'automation_cutover_at', v_cutover)
    from candidates c
    where c.reminder_kind is not null
    on conflict (deterministic_key) do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

revoke all on function public.baseline_reminders_for_cutover(timestamptz) from public, anon, authenticated;
grant execute on function public.baseline_reminders_for_cutover(timestamptz) to service_role;

revoke all on function public.enqueue_due_reminder_events(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_due_reminder_events(timestamptz) to service_role;

-- Materialize the immutable baseline in the same recorded migration transaction.
-- This only writes skipped/completed audit rows; it never calls a delivery or cron function.
select public.baseline_reminders_for_cutover(statement_timestamp());

comment on column public.admin_settings.automation_cutover_at is
  'Immutable M3 timestamp separating migration history from future reminder eligibility.';
comment on column public.admin_settings.automation_baseline_completed_at is
  'Timestamp proving skipped_migration_baseline events were committed before Supabase automation was enabled.';
comment on function public.baseline_reminders_for_cutover(timestamptz) is
  'One-shot, idempotent service-role baseline. Historical windows are completed with all delivery channels skipped.';
