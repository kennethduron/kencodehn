-- M2B application readiness: deterministic Supabase reminder queue preparation (no delivery side effects).
create or replace function public.enqueue_due_reminder_events(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare inserted_count integer;
begin
  with settings as (select * from public.admin_settings where id='default'),
  candidates as (
    select t.*,
      case
        when t.due_at <= p_now and coalesce((select task_overdue_enabled from settings),true) then 'overdue'::public.reminder_kind
        when t.due_at <= p_now + interval '1 hour' and coalesce((select task_reminder_one_hour_enabled from settings),true) then 'one_hour'::public.reminder_kind
        when t.due_at <= p_now + interval '1 day' and coalesce((select task_reminder_one_day_enabled from settings),true) then 'one_day'::public.reminder_kind
        else null
      end as reminder_kind
    from public.tasks t
    where t.status in ('pending','in_progress','overdue') and t.assigned_to is not null and t.due_at is not null and t.due_at <= p_now + interval '1 day'
  ), inserted as (
    insert into public.reminder_events(firebase_id,deterministic_key,task_id,recipient_id,kind,status,metadata)
    select 'supabase:'||encode(extensions.digest(c.id::text||'|'||c.reminder_kind::text||'|'||c.due_at::text,'sha256'),'hex'),
      encode(extensions.digest(c.id::text||'|'||c.reminder_kind::text||'|'||c.due_at::text,'sha256'),'hex'),
      c.id,c.assigned_to,c.reminder_kind,'pending',jsonb_build_object('due_at',c.due_at)
    from candidates c where c.reminder_kind is not null
    on conflict (deterministic_key) do nothing returning 1
  ) select count(*) into inserted_count from inserted;
  return inserted_count;
end; $$;

revoke all on function public.enqueue_due_reminder_events(timestamptz) from public,anon,authenticated;
grant execute on function public.enqueue_due_reminder_events(timestamptz) to service_role;
