-- Durable assignment delivery, Push device lifecycle, and five-minute reminder scheduling.
alter table public.device_tokens
  add column last_seen_at timestamptz not null default now(),
  add column expires_at timestamptz,
  add column device_name text;
create index device_tokens_stale_idx on public.device_tokens(last_seen_at) where active;

create index if not exists leads_assigned_to_count_idx on public.leads(assigned_to) where assigned_to is not null;
create index if not exists mail_attachments_message_idx on public.mail_attachments(message_id) where message_id is not null;

create table public.assignment_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check(event_type in ('task_assigned','lead_assigned')),
  entity_id uuid not null,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  assignment_at timestamptz not null,
  deterministic_key text not null unique,
  state text not null default 'pending' check(state in ('pending','processing','completed','failed')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint assignment_notification_lease_valid check((state='processing' and lease_token is not null and lease_expires_at is not null) or state<>'processing')
);
create index assignment_notification_due_idx on public.assignment_notification_events(state,next_attempt_at,created_at);
alter table public.assignment_notification_events enable row level security;
alter table public.assignment_notification_events force row level security;
revoke all on public.assignment_notification_events from public,anon,authenticated;
grant select,insert,update on public.assignment_notification_events to service_role;

create or replace function private.enqueue_assignment_notification()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_type text:=case when tg_table_name='tasks' then 'task_assigned' else 'lead_assigned' end;
declare v_at timestamptz:=coalesce(new.assigned_at,now());
begin
  if new.assigned_to is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.assignment_notification_events(event_type,entity_id,recipient_id,assignment_at,deterministic_key)
    values(v_type,new.id,new.assigned_to,v_at,v_type||':'||new.id::text||':'||new.assigned_to::text||':'||extract(epoch from v_at)::text)
    on conflict(deterministic_key) do nothing;
  end if;
  return new;
end; $$;
create trigger tasks_enqueue_assignment_notification after insert or update of assigned_to on public.tasks for each row execute function private.enqueue_assignment_notification();
create trigger leads_enqueue_assignment_notification after insert or update of assigned_to on public.leads for each row execute function private.enqueue_assignment_notification();

create or replace function public.claim_assignment_notification_events(
  p_worker uuid,p_limit integer default 25,p_event_type text default null,p_entity_id uuid default null,p_now timestamptz default now()
) returns setof public.assignment_notification_events language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_limit not between 1 and 100 then raise exception 'invalid claim limit' using errcode='22023'; end if;
  update public.assignment_notification_events set state='failed',lease_token=null,lease_expires_at=null,next_attempt_at=p_now,last_error='lease_expired'
    where state='processing' and lease_expires_at<p_now;
  return query with candidates as (
    select id from public.assignment_notification_events
    where state in ('pending','failed') and (next_attempt_at is null or next_attempt_at<=p_now)
      and (p_event_type is null or event_type=p_event_type) and (p_entity_id is null or entity_id=p_entity_id)
    order by created_at,id for update skip locked limit p_limit
  )
  update public.assignment_notification_events event set state='processing',lease_token=p_worker,lease_expires_at=p_now+interval '5 minutes',attempt_count=attempt_count+1
  from candidates where event.id=candidates.id returning event.*;
end; $$;

create or replace function public.complete_assignment_notification_event(
  p_id uuid,p_worker uuid,p_succeeded boolean,p_error text default null,p_now timestamptz default now()
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_changed integer;
begin
  update public.assignment_notification_events set
    state=case when p_succeeded then 'completed' else 'failed' end,
    completed_at=case when p_succeeded then p_now else null end,
    next_attempt_at=case when p_succeeded then null else p_now+least(interval '6 hours',interval '5 minutes'*power(2,least(attempt_count,6))) end,
    lease_token=null,lease_expires_at=null,last_error=case when p_succeeded then null else left(coalesce(p_error,'channel_delivery_failed'),80) end
  where id=p_id and state='processing' and lease_token=p_worker;
  get diagnostics v_changed=row_count;
  return v_changed=1;
end; $$;
revoke all on function public.claim_assignment_notification_events(uuid,integer,text,uuid,timestamptz),public.complete_assignment_notification_event(uuid,uuid,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_assignment_notification_events(uuid,integer,text,uuid,timestamptz),public.complete_assignment_notification_event(uuid,uuid,boolean,text,timestamptz) to service_role;

create table public.task_reminder_scheduler_state (
  id text primary key default 'default' check(id='default'),
  provider text not null default 'supabase_cron' check(provider='supabase_cron'),
  endpoint text not null,
  schedule text not null,
  configured_at timestamptz not null default now()
);
alter table public.task_reminder_scheduler_state enable row level security;
alter table public.task_reminder_scheduler_state force row level security;
grant select on public.task_reminder_scheduler_state to authenticated;
create policy task_reminder_scheduler_read_admin on public.task_reminder_scheduler_state for select to authenticated
  using(private.current_profile_role() in ('owner','admin'));

create or replace function public.task_reminder_configure_scheduler(p_endpoint text,p_secret text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job record; v_secret_id uuid; v_command text;
begin
  if p_endpoint<>'https://kencodehn.com/api/cron/task-reminders' or length(p_secret)<48 then
    raise exception 'invalid task reminder scheduler configuration' using errcode='22023';
  end if;
  delete from vault.secrets where name='task_reminder_cron_secret';
  select vault.create_secret(p_secret,'task_reminder_cron_secret','Ken Code task reminder dispatcher authentication') into v_secret_id;
  for v_job in select jobid from cron.job where jobname='ken-code-task-reminders' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  v_command:=format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''content-type'',''application/json'',''authorization'',''Bearer ''||(select decrypted_secret from vault.decrypted_secrets where name=''task_reminder_cron_secret'')), body := jsonb_build_object(''source'',''supabase_cron''), timeout_milliseconds := 60000);',
    p_endpoint
  );
  perform cron.schedule('ken-code-task-reminders','*/5 * * * *',v_command);
  insert into public.task_reminder_scheduler_state(id,provider,endpoint,schedule,configured_at)
  values('default','supabase_cron',p_endpoint,'*/5 * * * *',now())
  on conflict(id) do update set provider=excluded.provider,endpoint=excluded.endpoint,schedule=excluded.schedule,configured_at=excluded.configured_at;
  return jsonb_build_object('provider','supabase_cron','schedule','*/5 * * * *','secretStored',v_secret_id is not null);
end; $$;
revoke all on function public.task_reminder_configure_scheduler(text,text) from public,anon,authenticated;
grant execute on function public.task_reminder_configure_scheduler(text,text) to service_role;

create or replace function private.enforce_personal_notification_preference()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_event text;
declare v_preferences public.user_notification_preferences%rowtype;
begin
  if new.recipient_id is null then return new; end if;
  v_event := case
    when new.type in ('task_created','task_assigned') then 'task_assigned'
    when new.type in ('task_reminder','task_due','task_overdue','mail_follow_up') then 'follow_up'
    when new.type='mail_received' then 'mail_received'
    when new.type in ('payment_due_7_days','payment_due_3_days','payment_due_today','payment_overdue','payment_received') then 'billing'
    when new.type in ('proposal_activity','module') then 'proposal_activity'
    else null
  end;
  if v_event is null then return new; end if;
  select * into v_preferences from public.user_notification_preferences where profile_id=new.recipient_id;
  if not found then return new; end if;
  if not v_preferences.internal_enabled or coalesce((v_preferences.event_preferences->v_event->>'crm')::boolean,true)=false then return null; end if;
  return new;
end; $$;
create trigger notifications_personal_preference
before insert on public.notifications for each row execute function private.enforce_personal_notification_preference();

comment on table public.username_history is 'Prevents unsafe username reuse and preserves attribution after account lifecycle changes.';
comment on table public.corporate_mail_signatures is 'Immutable versions of Owner-controlled signature branding; active rows are used for new messages.';
comment on column public.mail_messages.signature_snapshot is 'Resolved signature version and rendered HTML used when this immutable message was sent.';
comment on function public.task_reminder_configure_scheduler(text,text) is 'Service-role-only setup for the five-minute task reminder dispatcher. The secret is stored in Supabase Vault.';
