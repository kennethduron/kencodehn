-- Phase 2: recurring generation, deterministic billing events and Supabase Cron configuration.
create type public.billing_event_state as enum ('scheduled', 'processing', 'sent', 'failed', 'skipped', 'superseded');

create table public.billing_reminder_rules (
  id uuid primary key,
  name text not null unique,
  event_type text not null unique,
  offset_days integer not null,
  direction text not null check (direction in ('before', 'on', 'after')),
  send_time time without time zone not null default '09:00',
  due_time_only boolean not null default false,
  channel text not null default 'email' check (channel = 'email'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_rule_event_valid check (event_type in ('payment_due_7_days','payment_due_3_days','payment_due_today','payment_due_time','payment_overdue_1_day')),
  constraint billing_rule_offset_valid check (
    (direction='before' and offset_days > 0)
    or (direction='on' and offset_days = 0)
    or (direction='after' and offset_days > 0)
  )
);

insert into public.billing_reminder_rules(id,name,event_type,offset_days,direction,send_time,due_time_only) values
  ('20000000-0000-4000-8000-000000000007','7 días antes','payment_due_7_days',7,'before','09:00',false),
  ('20000000-0000-4000-8000-000000000003','3 días antes','payment_due_3_days',3,'before','09:00',false),
  ('20000000-0000-4000-8000-000000000000','Día de vencimiento','payment_due_today',0,'on','09:00',false),
  ('20000000-0000-4000-8000-000000000001','Hora de vencimiento','payment_due_time',0,'on','09:00',true),
  ('20000000-0000-4000-8000-000000000101','1 día vencido','payment_overdue_1_day',1,'after','09:00',false);

create table public.billing_reminder_events (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete restrict,
  rule_id uuid not null references public.billing_reminder_rules(id) on delete restrict,
  schedule_version integer not null check (schedule_version > 0),
  deterministic_key text not null unique,
  event_type text not null,
  scheduled_at timestamptz not null,
  state public.billing_event_state not null default 'scheduled',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  retry_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text,
  error_category text,
  sent_at timestamptz,
  skipped_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(receivable_id, rule_id, schedule_version),
  constraint reminder_lease_consistent check ((state='processing' and lease_token is not null and lease_expires_at is not null) or state<>'processing'),
  constraint reminder_sent_consistent check ((state='sent' and sent_at is not null) or state<>'sent')
);

create table public.billing_email_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('payment_schedule_created','payment_schedule_updated','payment_received')),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  payment_plan_id uuid references public.project_payment_plans(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  deterministic_key text not null unique,
  recipient text not null,
  locale text not null check (locale in ('es','en')),
  scheduled_at timestamptz not null default now(),
  state public.billing_event_state not null default 'scheduled',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  retry_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_message_id text,
  error_category text,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_email_origin_valid check (
    (event_type in ('payment_schedule_created','payment_schedule_updated') and project_id is not null and payment_plan_id is not null and payment_id is null)
    or (event_type='payment_received' and payment_id is not null and payment_plan_id is null)
  ),
  constraint billing_email_lease_consistent check ((state='processing' and lease_token is not null and lease_expires_at is not null) or state<>'processing')
);

create table public.billing_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('generation','delivery')),
  source text not null default 'supabase_cron',
  status text not null check (status in ('running','succeeded','failed')),
  processed integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  error_category text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb
);

create table public.billing_scheduler_state (
  id text primary key default 'default' check (id='default'),
  provider text not null default 'supabase_cron' check (provider='supabase_cron'),
  endpoint text not null,
  generation_schedule text not null,
  delivery_schedule text not null,
  configured_at timestamptz not null default now()
);

create index billing_reminder_due_idx on public.billing_reminder_events(state, scheduled_at, retry_at);
create index billing_email_due_idx on public.billing_email_events(state, scheduled_at, retry_at);
create index billing_job_runs_started_idx on public.billing_job_runs(started_at desc);

create trigger billing_rules_set_updated_at before update on public.billing_reminder_rules for each row execute function private.set_updated_at();
create trigger billing_reminder_events_set_updated_at before update on public.billing_reminder_events for each row execute function private.set_updated_at();
create trigger billing_email_events_set_updated_at before update on public.billing_email_events for each row execute function private.set_updated_at();

alter table public.email_logs
  add column client_id uuid references public.clients(id) on delete restrict,
  add column project_id uuid references public.projects(id) on delete restrict,
  add column receivable_id uuid references public.receivables(id) on delete restrict,
  add column payment_id uuid references public.payments(id) on delete restrict;
alter table public.email_logs drop constraint email_logs_type_valid;
alter table public.email_logs add constraint email_logs_type_valid check (type in (
  'admin_new_lead_notification','client_lead_confirmation','task_reminder','task_overdue','status_update','daily_summary','user_invitation','owner_email_verification',
  'payment_schedule_created','payment_schedule_updated','payment_due_7_days','payment_due_3_days','payment_due_today','payment_due_time','payment_overdue_1_day','payment_received'
));

create or replace function private.billing_event_time(p_receivable public.receivables, p_rule public.billing_reminder_rules)
returns timestamptz language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_date date;
begin
  if p_rule.due_time_only then return p_receivable.due_at; end if;
  v_date := case p_rule.direction
    when 'before' then p_receivable.due_date - p_rule.offset_days
    when 'after' then p_receivable.due_date + p_rule.offset_days
    else p_receivable.due_date end;
  return private.billing_wall_clock_at(v_date,p_rule.send_time,p_receivable.due_timezone);
end;
$$;

create or replace function private.schedule_receivable_reminders(p_receivable_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_receivable public.receivables%rowtype; v_rule public.billing_reminder_rules%rowtype; v_count integer:=0; v_at timestamptz; v_key text;
begin
  select * into v_receivable from public.receivables where id=p_receivable_id;
  if not found or v_receivable.payment_state in ('paid','cancelled') or not v_receivable.notifications_enabled then return 0; end if;
  for v_rule in select * from public.billing_reminder_rules where enabled order by offset_days desc loop
    if v_rule.due_time_only and v_receivable.due_time is null then continue; end if;
    v_at:=private.billing_event_time(v_receivable,v_rule);
    if v_at is null then continue; end if;
    v_key:='billing-reminder:'||v_receivable.id::text||':'||v_rule.id::text||':v'||v_receivable.schedule_version::text;
    insert into public.billing_reminder_events(receivable_id,rule_id,schedule_version,deterministic_key,event_type,scheduled_at)
    values(v_receivable.id,v_rule.id,v_receivable.schedule_version,v_key,v_rule.event_type,v_at)
    on conflict(receivable_id,rule_id,schedule_version) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end;
$$;

create or replace function private.receivable_reminder_lifecycle()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_changed integer:=0; v_event_id uuid;
begin
  if tg_op='UPDATE' and (old.schedule_version<>new.schedule_version or old.payment_state<>new.payment_state or old.notifications_enabled<>new.notifications_enabled) then
    update public.billing_reminder_events set state='superseded',lease_token=null,lease_expires_at=null,skipped_reason='receivable_changed'
    where receivable_id=new.id and state in ('scheduled','failed','processing') and schedule_version<>new.schedule_version;
  end if;
  if new.payment_state in ('paid','cancelled') or not new.notifications_enabled then
    update public.billing_reminder_events set state=case when state='processing' then 'superseded'::public.billing_event_state else 'skipped'::public.billing_event_state end,
      lease_token=null,lease_expires_at=null,skipped_reason=case when new.payment_state='paid' then 'receivable_paid' when new.payment_state='cancelled' then 'receivable_cancelled' else 'notifications_disabled' end
    where receivable_id=new.id and state in ('scheduled','failed','processing');
    get diagnostics v_changed=row_count;
    if v_changed>0 then
      v_event_id:=gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      select v_event_id,'supabase:'||v_event_id::text,'billing',new.id::text,new.client_id,new.project_id,new.id,null,'system',coalesce(p.assigned_to,p.created_by),
        'billing_reminder_skipped','Recordatorios omitidos','La automatización omitió recordatorios porque la obligación ya no es elegible.',
        jsonb_build_object('reason',case when new.payment_state='paid' then 'receivable_paid' when new.payment_state='cancelled' then 'receivable_cancelled' else 'notifications_disabled' end,'eventCount',v_changed),now()
      from public.projects p where p.id=new.project_id;
    end if;
  else
    perform private.schedule_receivable_reminders(new.id);
  end if;
  return new;
end;
$$;
create trigger receivable_reminder_lifecycle
after insert or update of payment_state,schedule_version,notifications_enabled on public.receivables
for each row execute function private.receivable_reminder_lifecycle();

create or replace function private.recurring_period_date(p_service public.project_recurring_services,p_index integer)
returns date language plpgsql immutable security definer set search_path=pg_catalog as $$
declare v_months integer; v_month date;
begin
  if p_index=0 then return p_service.start_date; end if;
  v_months:=case p_service.frequency when 'monthly' then p_index when 'quarterly' then p_index*3 else p_index*12 end;
  v_month:=(date_trunc('month',p_service.start_date)::date + make_interval(months=>v_months))::date;
  return v_month + (p_service.billing_day-1);
end;
$$;

create or replace function private.generate_recurring_receivables_for_service(p_service_id uuid,p_horizon_date date)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_service public.project_recurring_services%rowtype; v_project public.projects%rowtype; v_index integer; v_due date; v_period text; v_inserted integer:=0; v_receivable_id uuid; v_event_id uuid;
begin
  select * into v_service from public.project_recurring_services where id=p_service_id for update;
  if not found or v_service.status<>'active' then return 0; end if;
  select * into v_project from public.projects where id=v_service.project_id;
  for v_index in 0..120 loop
    v_due:=private.recurring_period_date(v_service,v_index);
    exit when v_due>p_horizon_date;
    continue when v_due<v_service.start_date;
    v_period:=case v_service.frequency
      when 'monthly' then to_char(v_due,'YYYY-MM')
      when 'quarterly' then to_char(v_due,'YYYY')||'-Q'||extract(quarter from v_due)::integer::text
      else to_char(v_due,'YYYY') end;
    insert into public.receivables(client_id,project_id,origin_type,recurring_service_id,recurring_period_key,description,amount_due_minor,currency,due_date,due_time,due_timezone,notifications_enabled,created_by,metadata)
    values(v_project.client_id,v_project.id,'recurring_service',v_service.id,v_period,v_service.name,v_service.monthly_amount_minor,v_service.currency,v_due,v_service.billing_time,v_service.timezone,true,v_service.updated_by,jsonb_build_object('frequency',v_service.frequency))
    on conflict(recurring_service_id,recurring_period_key) where recurring_service_id is not null do nothing
    returning id into v_receivable_id;
    if found then
      v_inserted:=v_inserted+1;
      v_event_id:=gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'receivable',v_receivable_id::text,v_project.client_id,v_project.id,v_receivable_id,null,'system',coalesce(v_project.assigned_to,v_project.created_by),
        'recurring_receivable_generated','Mensualidad generada','La automatización generó una cuenta por cobrar recurrente.',jsonb_build_object('periodKey',v_period),now());
    end if;
  end loop;
  return v_inserted;
end;
$$;

create or replace function public.billing_generate_recurring(p_horizon_days integer default 45,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_service record; v_count integer:=0; v_today date;
begin
  if p_horizon_days not between 1 and 120 then raise exception 'invalid generation horizon' using errcode='22023'; end if;
  v_today:=(p_now at time zone 'America/Tegucigalpa')::date;
  for v_service in select id from public.project_recurring_services where status='active' order by id loop
    v_count:=v_count+private.generate_recurring_receivables_for_service(v_service.id,v_today+p_horizon_days);
  end loop;
  return jsonb_build_object('created',v_count,'horizonDate',v_today+p_horizon_days);
end;
$$;
revoke all on function public.billing_generate_recurring(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_generate_recurring(integer,timestamptz) to service_role;

create or replace function public.billing_run_generation(p_horizon_days integer default 45,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_run_id uuid:=gen_random_uuid(); v_started timestamptz:=clock_timestamp(); v_result jsonb;
begin
  insert into public.billing_job_runs(id,job_type,source,status) values(v_run_id,'generation','supabase_cron','running');
  begin
    v_result:=public.billing_generate_recurring(p_horizon_days,p_now);
    update public.billing_job_runs set status='succeeded',processed=(v_result->>'created')::integer,finished_at=clock_timestamp(),duration_ms=greatest(0,(extract(epoch from (clock_timestamp()-v_started))*1000)::integer) where id=v_run_id;
    return v_result||jsonb_build_object('runId',v_run_id);
  exception when others then
    update public.billing_job_runs set status='failed',error_category=sqlstate,finished_at=clock_timestamp(),duration_ms=greatest(0,(extract(epoch from (clock_timestamp()-v_started))*1000)::integer) where id=v_run_id;
    raise;
  end;
end;
$$;
revoke all on function public.billing_run_generation(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_run_generation(integer,timestamptz) to service_role;

create or replace function private.recurring_activation_generation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status or old.start_date is distinct from new.start_date or old.billing_day is distinct from new.billing_day) then
    perform private.generate_recurring_receivables_for_service(new.id,(now() at time zone 'America/Tegucigalpa')::date+45);
  end if;
  return new;
end;
$$;
create trigger recurring_activation_generation
after insert or update of status,start_date,billing_day on public.project_recurring_services
for each row execute function private.recurring_activation_generation();

create or replace function private.enqueue_plan_email()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_project public.projects%rowtype; v_client public.clients%rowtype; v_recipient text; v_type text; v_all_future boolean;
begin
  if new.status<>'active' or old.status='active' then return new; end if;
  select * into v_project from public.projects where id=new.project_id;
  select * into v_client from public.clients where id=v_project.client_id;
  v_recipient:=coalesce(nullif(v_client.billing_email,''),nullif(v_client.email,''));
  select coalesce(bool_and(due_date >= (now() at time zone 'America/Tegucigalpa')::date),false) into v_all_future
  from public.project_installments where payment_plan_id=new.id;
  if new.notification_policy='historical_import' or not v_all_future or not v_client.billing_notifications_enabled or v_recipient is null then return new; end if;
  v_type:=case when exists(select 1 from public.project_payment_plans where project_id=new.project_id and id<>new.id and status='archived') then 'payment_schedule_updated' else 'payment_schedule_created' end;
  insert into public.billing_email_events(event_type,client_id,project_id,payment_plan_id,deterministic_key,recipient,locale,payload)
  values(v_type,v_client.id,v_project.id,new.id,'billing-email:'||v_type||':'||new.id::text||':v'||new.version::text,v_recipient,v_client.billing_locale,jsonb_build_object('planVersion',new.version))
  on conflict(deterministic_key) do nothing;
  return new;
end;
$$;
create trigger payment_plan_enqueue_email
after update of status on public.project_payment_plans
for each row execute function private.enqueue_plan_email();

create or replace function private.enqueue_payment_email()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_client public.clients%rowtype; v_recipient text;
begin
  if not new.notify_client then return new; end if;
  select * into v_client from public.clients where id=new.client_id;
  v_recipient:=coalesce(nullif(v_client.billing_email,''),nullif(v_client.email,''));
  if not v_client.billing_notifications_enabled or not v_client.payment_confirmation_enabled or v_recipient is null then return new; end if;
  insert into public.billing_email_events(event_type,client_id,payment_id,deterministic_key,recipient,locale,payload)
  values('payment_received',v_client.id,new.id,'billing-email:payment_received:'||new.id::text,v_recipient,v_client.billing_locale,jsonb_build_object('paymentId',new.id))
  on conflict(deterministic_key) do nothing;
  return new;
end;
$$;
create trigger payment_enqueue_email after insert on public.payments for each row execute function private.enqueue_payment_email();

create or replace function public.billing_claim_reminders(p_worker_id uuid,p_limit integer default 50,p_now timestamptz default now())
returns table(event_id uuid,event_type text,deterministic_key text,receivable_id uuid,client_id uuid,project_id uuid,recipient text,locale text,description text,amount_due_minor bigint,amount_paid_minor bigint,balance_minor bigint,currency text,due_date date,due_time time without time zone,project_name text,client_name text)
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_limit not between 1 and 100 then raise exception 'invalid claim limit' using errcode='22023'; end if;
  update public.billing_reminder_events set state='failed',lease_token=null,lease_expires_at=null,retry_at=p_now,error_category='lease_expired'
  where state='processing' and lease_expires_at<p_now;
  return query
  with candidates as (
    select e.id from public.billing_reminder_events e
    join public.receivables r on r.id=e.receivable_id
    join public.clients c on c.id=r.client_id
    where e.state in ('scheduled','failed') and e.scheduled_at<=p_now and (e.retry_at is null or e.retry_at<=p_now)
      and r.payment_state in ('open','partially_paid') and r.notifications_enabled and c.billing_notifications_enabled
      and coalesce(nullif(c.billing_email,''),nullif(c.email,'')) is not null
    order by e.scheduled_at,e.id for update of e skip locked limit p_limit
  ), claimed as (
    update public.billing_reminder_events e set state='processing',lease_token=p_worker_id,lease_expires_at=p_now+interval '10 minutes',attempt_count=attempt_count+1
    from candidates c where e.id=c.id returning e.*
  )
  select e.id,e.event_type,e.deterministic_key,r.id,r.client_id,r.project_id,
    coalesce(nullif(c.billing_email,''),nullif(c.email,'')),c.billing_locale,r.description,r.amount_due_minor,r.amount_paid_minor,r.balance_minor,r.currency,r.due_date,r.due_time,p.name,c.name
  from claimed e join public.receivables r on r.id=e.receivable_id join public.clients c on c.id=r.client_id join public.projects p on p.id=r.project_id;
end;
$$;

create or replace function public.billing_claim_emails(p_worker_id uuid,p_limit integer default 25,p_now timestamptz default now())
returns setof public.billing_email_events language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.billing_email_events set state='failed',lease_token=null,lease_expires_at=null,retry_at=p_now,error_category='lease_expired'
  where state='processing' and lease_expires_at<p_now;
  return query
  with candidates as (
    select id from public.billing_email_events where state in ('scheduled','failed') and scheduled_at<=p_now and (retry_at is null or retry_at<=p_now)
    order by scheduled_at,id for update skip locked limit p_limit
  )
  update public.billing_email_events e set state='processing',lease_token=p_worker_id,lease_expires_at=p_now+interval '10 minutes',attempt_count=attempt_count+1
  from candidates c where e.id=c.id returning e.*;
end;
$$;

create or replace function public.billing_complete_event(p_kind text,p_event_id uuid,p_worker_id uuid,p_sent boolean,p_provider_message_id text default null,p_error_category text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_changed integer; v_event_id uuid; v_reminder record; v_email record;
begin
  if p_kind='reminder' then
    select e.event_type,e.receivable_id,r.client_id,r.project_id,p.assigned_to,p.created_by into v_reminder
    from public.billing_reminder_events e join public.receivables r on r.id=e.receivable_id join public.projects p on p.id=r.project_id
    where e.id=p_event_id;
    update public.billing_reminder_events set state=case when p_sent then 'sent'::public.billing_event_state else 'failed'::public.billing_event_state end,
      sent_at=case when p_sent then now() else null end,provider_message_id=p_provider_message_id,error_category=p_error_category,
      retry_at=case when p_sent then null else now()+least(interval '6 hours',interval '5 minutes'*power(2,least(attempt_count,6))) end,
      lease_token=null,lease_expires_at=null
    where id=p_event_id and state='processing' and lease_token=p_worker_id;
  elsif p_kind='email' then
    select e.event_type,e.client_id,e.project_id,e.payment_id,p.assigned_to,p.created_by into v_email
    from public.billing_email_events e left join public.projects p on p.id=e.project_id where e.id=p_event_id;
    update public.billing_email_events set state=case when p_sent then 'sent'::public.billing_event_state else 'failed'::public.billing_event_state end,
      sent_at=case when p_sent then now() else null end,provider_message_id=p_provider_message_id,error_category=p_error_category,
      retry_at=case when p_sent then null else now()+least(interval '6 hours',interval '5 minutes'*power(2,least(attempt_count,6))) end,
      lease_token=null,lease_expires_at=null
    where id=p_event_id and state='processing' and lease_token=p_worker_id;
  else raise exception 'invalid billing event kind' using errcode='22023';
  end if;
  get diagnostics v_changed=row_count;
  if v_changed=1 then
    v_event_id:=gen_random_uuid();
    if p_kind='reminder' then
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'billing',p_event_id::text,v_reminder.client_id,v_reminder.project_id,v_reminder.receivable_id,null,'system',coalesce(v_reminder.assigned_to,v_reminder.created_by),
        case when p_sent then 'billing_reminder_sent' else 'billing_reminder_failed' end,
        case when p_sent then 'Recordatorio de cobro enviado' else 'Recordatorio de cobro fallido' end,
        case when p_sent then 'La automatización entregó un recordatorio transaccional.' else 'La automatización programó un reintento del recordatorio.' end,
        jsonb_build_object('eventType',v_reminder.event_type,'errorCategory',p_error_category),now());
      if p_sent and v_reminder.event_type='payment_due_today' then
        perform private.financial_internal_notification('payment_due_today',v_reminder.client_id,v_reminder.receivable_id,null,'Pago programado para hoy','Una cuenta por cobrar vence hoy.','/admin/cobros/'||v_reminder.receivable_id::text);
      elsif p_sent and v_reminder.event_type='payment_overdue_1_day' then
        perform private.financial_internal_notification('payment_overdue',v_reminder.client_id,v_reminder.receivable_id,null,'Pago vencido','Una cuenta por cobrar está vencida.','/admin/cobros/'||v_reminder.receivable_id::text);
      end if;
    else
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,payment_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'billing',p_event_id::text,v_email.client_id,v_email.project_id,v_email.payment_id,null,'system',coalesce(v_email.assigned_to,v_email.created_by),
        case when v_email.event_type='payment_schedule_updated' then 'billing_schedule_updated' else 'billing_schedule_notified' end,
        case when p_sent then 'Comunicación de cobro enviada' else 'Comunicación de cobro fallida' end,
        case when p_sent then 'La automatización entregó una comunicación transaccional.' else 'La automatización programó un reintento de la comunicación.' end,
        jsonb_build_object('eventType',v_email.event_type,'sent',p_sent,'errorCategory',p_error_category),now());
    end if;
  end if;
  return v_changed=1;
end;
$$;

revoke all on function public.billing_claim_reminders(uuid,integer,timestamptz),public.billing_claim_emails(uuid,integer,timestamptz),public.billing_complete_event(text,uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.billing_claim_reminders(uuid,integer,timestamptz),public.billing_claim_emails(uuid,integer,timestamptz),public.billing_complete_event(text,uuid,uuid,boolean,text,text) to service_role;

create or replace function public.billing_rule_write(p_rule_id uuid,p_enabled boolean,p_send_time time without time zone)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id=auth.uid() and active;
  if not found or v_actor.role not in ('owner','admin') then raise exception 'billing settings forbidden' using errcode='42501'; end if;
  update public.billing_reminder_rules set enabled=p_enabled,send_time=p_send_time where id=p_rule_id;
  if not found then raise exception 'billing rule not found' using errcode='P0002'; end if;
  return jsonb_build_object('id',p_rule_id,'enabled',p_enabled,'sendTime',p_send_time);
end;
$$;
revoke all on function public.billing_rule_write(uuid,boolean,time without time zone) from public,anon;
grant execute on function public.billing_rule_write(uuid,boolean,time without time zone) to authenticated;

alter table public.billing_reminder_rules enable row level security;
alter table public.billing_reminder_rules force row level security;
alter table public.billing_reminder_events enable row level security;
alter table public.billing_reminder_events force row level security;
alter table public.billing_email_events enable row level security;
alter table public.billing_email_events force row level security;
alter table public.billing_job_runs enable row level security;
alter table public.billing_job_runs force row level security;
alter table public.billing_scheduler_state enable row level security;
alter table public.billing_scheduler_state force row level security;
grant select on public.billing_reminder_rules,public.billing_reminder_events,public.billing_email_events,public.billing_job_runs,public.billing_scheduler_state to authenticated;
create policy billing_rules_read on public.billing_reminder_rules for select to authenticated using (private.current_profile_role() in ('owner','admin','manager','viewer','sales_agent'));
create policy billing_reminders_read on public.billing_reminder_events for select to authenticated using (private.receivable_in_current_scope(receivable_id));
create policy billing_emails_read_admin on public.billing_email_events for select to authenticated using (private.current_profile_role() in ('owner','admin'));
create policy billing_jobs_read_admin on public.billing_job_runs for select to authenticated using (private.current_profile_role() in ('owner','admin'));
create policy billing_scheduler_read_admin on public.billing_scheduler_state for select to authenticated using (private.current_profile_role() in ('owner','admin'));

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

create or replace function public.billing_configure_scheduler(p_endpoint text,p_secret text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job record; v_secret_id uuid; v_delivery_command text;
begin
  if p_endpoint<>'https://kencodehn.com/api/cron/billing' or length(p_secret)<48 then raise exception 'invalid billing scheduler configuration' using errcode='22023'; end if;
  delete from vault.secrets where name='billing_cron_secret';
  select vault.create_secret(p_secret,'billing_cron_secret','Ken Code billing dispatcher authentication') into v_secret_id;
  for v_job in select jobid from cron.job where jobname in ('ken-code-billing-generation','ken-code-billing-delivery') loop perform cron.unschedule(v_job.jobid); end loop;
  perform cron.schedule('ken-code-billing-generation','10 7 * * *','select public.billing_run_generation(45,now());');
  v_delivery_command:=format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''content-type'',''application/json'',''authorization'',''Bearer ''||(select decrypted_secret from vault.decrypted_secrets where name=''billing_cron_secret'')), body := jsonb_build_object(''source'',''supabase_cron''), timeout_milliseconds := 10000);',
    p_endpoint
  );
  perform cron.schedule('ken-code-billing-delivery','*/15 * * * *',v_delivery_command);
  insert into public.billing_scheduler_state(id,provider,endpoint,generation_schedule,delivery_schedule,configured_at)
  values('default','supabase_cron',p_endpoint,'10 7 * * *','*/15 * * * *',now())
  on conflict(id) do update set provider=excluded.provider,endpoint=excluded.endpoint,generation_schedule=excluded.generation_schedule,delivery_schedule=excluded.delivery_schedule,configured_at=excluded.configured_at;
  return jsonb_build_object('provider','supabase_cron','generation','10 7 * * *','delivery','*/15 * * * *','secretStored',v_secret_id is not null);
end;
$$;
revoke all on function public.billing_configure_scheduler(text,text) from public,anon,authenticated;
grant execute on function public.billing_configure_scheduler(text,text) to service_role;

comment on table public.billing_reminder_events is 'Deterministic at-least-once billing reminders with leases, retries and strong deduplication.';
comment on function public.billing_configure_scheduler(text,text) is 'Service-role-only environment configuration. The secret is stored in Supabase Vault and never committed.';
