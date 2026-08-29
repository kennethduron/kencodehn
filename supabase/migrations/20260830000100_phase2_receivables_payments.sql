-- Phase 2: real receivables, posted payments and immutable allocations.
create type public.receivable_origin_type as enum ('project_installment', 'recurring_service');
create type public.receivable_payment_state as enum ('open', 'partially_paid', 'paid', 'cancelled');
create type public.financial_payment_status as enum ('posted', 'reversed');
create type public.payment_method as enum ('bank_transfer', 'cash', 'card', 'paypal', 'other');

alter table public.clients
  add column billing_email text not null default '',
  add column billing_notifications_enabled boolean not null default true,
  add column payment_confirmation_enabled boolean not null default true,
  add column billing_locale text not null default 'es',
  add column billing_timezone text not null default 'America/Tegucigalpa',
  add constraint clients_billing_email_valid check (billing_email = '' or (billing_email = lower(btrim(billing_email)) and position('@' in billing_email) > 1)),
  add constraint clients_billing_locale_valid check (billing_locale in ('es', 'en')),
  add constraint clients_billing_timezone_valid check (billing_timezone = 'America/Tegucigalpa');

alter table public.project_payment_plans
  add column notification_policy text not null default 'normal',
  add constraint payment_plan_notification_policy_valid check (notification_policy in ('normal', 'historical_import'));

alter table public.project_installments
  add column due_timezone text not null default 'America/Tegucigalpa',
  add column due_at timestamptz,
  add column schedule_version integer not null default 1 check (schedule_version > 0),
  add constraint project_installment_timezone_valid check (due_timezone = 'America/Tegucigalpa');

create or replace function private.billing_wall_clock_at(p_date date, p_time time without time zone, p_timezone text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if p_date is null or p_time is null then return null; end if;
  if p_timezone <> 'America/Tegucigalpa' then
    raise exception 'unsupported billing timezone' using errcode = '22023';
  end if;
  return make_timestamptz(
    extract(year from p_date)::integer,
    extract(month from p_date)::integer,
    extract(day from p_date)::integer,
    extract(hour from p_time)::integer,
    extract(minute from p_time)::integer,
    0,
    p_timezone
  );
end;
$$;

create or replace function private.set_installment_due_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.due_at := private.billing_wall_clock_at(new.due_date, new.due_time, new.due_timezone);
  if tg_op = 'UPDATE' and (old.due_date, old.due_time, old.due_timezone) is distinct from (new.due_date, new.due_time, new.due_timezone) then
    new.schedule_version := old.schedule_version + 1;
  end if;
  return new;
end;
$$;

create trigger project_installments_set_due_at
before insert or update of due_date, due_time, due_timezone on public.project_installments
for each row execute function private.set_installment_due_at();

update public.project_installments
set due_timezone = due_timezone;

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  origin_type public.receivable_origin_type not null,
  project_installment_id uuid references public.project_installments(id) on delete restrict,
  recurring_service_id uuid references public.project_recurring_services(id) on delete restrict,
  recurring_period_key text,
  description text not null default '',
  amount_due_minor bigint not null check (amount_due_minor > 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  balance_minor bigint generated always as (amount_due_minor - amount_paid_minor) stored,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  due_date date not null,
  due_time time without time zone,
  due_timezone text not null default 'America/Tegucigalpa',
  due_at timestamptz,
  schedule_version integer not null default 1 check (schedule_version > 0),
  payment_state public.receivable_payment_state not null default 'open',
  notifications_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancellation_reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivable_paid_not_over_due check (amount_paid_minor <= amount_due_minor),
  constraint receivable_timezone_valid check (due_timezone = 'America/Tegucigalpa'),
  constraint receivable_origin_valid check (
    (origin_type = 'project_installment' and project_installment_id is not null and recurring_service_id is null and recurring_period_key is null)
    or
    (origin_type = 'recurring_service' and project_installment_id is null and recurring_service_id is not null and length(btrim(recurring_period_key)) between 4 and 24)
  ),
  constraint receivable_state_valid check (
    (payment_state = 'open' and amount_paid_minor = 0 and cancelled_at is null)
    or (payment_state = 'partially_paid' and amount_paid_minor > 0 and amount_paid_minor < amount_due_minor and cancelled_at is null)
    or (payment_state = 'paid' and amount_paid_minor = amount_due_minor and cancelled_at is null)
    or (payment_state = 'cancelled' and amount_paid_minor = 0 and cancelled_at is not null and cancelled_by is not null and length(btrim(cancellation_reason)) > 0)
  )
);

create unique index receivables_installment_origin_idx
  on public.receivables(project_installment_id)
  where project_installment_id is not null;
create unique index receivables_recurring_period_idx
  on public.receivables(recurring_service_id, recurring_period_key)
  where recurring_service_id is not null;
create index receivables_scope_due_idx on public.receivables(client_id, project_id, due_date, payment_state);
create index receivables_open_due_idx on public.receivables(due_date, due_at) where payment_state in ('open', 'partially_paid');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  paid_at timestamptz not null,
  method public.payment_method not null,
  reference text not null default '',
  notes text not null default '',
  status public.financial_payment_status not null default 'posted',
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  reversal_reason text not null default '',
  notify_client boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_reference_valid check (length(reference) <= 240),
  constraint payments_notes_valid check (length(notes) <= 4000),
  constraint payment_reversal_consistent check (
    (status = 'posted' and reversed_at is null and reversed_by is null and reversal_reason = '')
    or (status = 'reversed' and reversed_at is not null and reversed_by is not null and length(btrim(reversal_reason)) > 0)
  )
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  receivable_id uuid not null references public.receivables(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  unique(payment_id, receivable_id),
  constraint allocation_reversal_consistent check ((reversed_at is null and reversed_by is null) or (reversed_at is not null and reversed_by is not null))
);

create index payments_client_paid_idx on public.payments(client_id, paid_at desc);
create index payment_allocations_receivable_idx on public.payment_allocations(receivable_id, created_at);

alter table public.activity_logs
  add column receivable_id uuid references public.receivables(id) on delete restrict,
  add column payment_id uuid references public.payments(id) on delete restrict;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in ('lead', 'note', 'task', 'notification', 'user', 'system', 'client', 'project', 'payment_plan', 'recurring_service', 'receivable', 'payment', 'billing'));

alter table public.notifications
  add column receivable_id uuid references public.receivables(id) on delete restrict,
  add column payment_id uuid references public.payments(id) on delete restrict;
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in (
  'lead', 'task', 'lead_new', 'lead_status_changed', 'lead_priority_changed',
  'note_added', 'task_created', 'task_updated', 'task_completed',
  'task_reminder', 'task_due', 'task_overdue', 'system',
  'payment_due_today', 'payment_overdue', 'payment_received'
));

create trigger receivables_set_updated_at before update on public.receivables for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();

create or replace function private.set_receivable_due_at()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  new.due_at := private.billing_wall_clock_at(new.due_date, new.due_time, new.due_timezone);
  if tg_op = 'UPDATE' and (old.due_date, old.due_time, old.due_timezone) is distinct from (new.due_date, new.due_time, new.due_timezone) then
    new.schedule_version := old.schedule_version + 1;
  end if;
  return new;
end;
$$;
create trigger receivables_set_due_at
before insert or update of due_date, due_time, due_timezone on public.receivables
for each row execute function private.set_receivable_due_at();

create or replace function private.block_financial_delete()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  raise exception 'financial history cannot be deleted' using errcode = '55000';
end;
$$;
create trigger receivables_no_delete before delete on public.receivables for each row execute function private.block_financial_delete();
create trigger payments_no_delete before delete on public.payments for each row execute function private.block_financial_delete();
create trigger allocations_no_delete before delete on public.payment_allocations for each row execute function private.block_financial_delete();

create or replace function private.receivable_in_current_scope(p_receivable_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(
    select 1 from public.receivables r
    where r.id = p_receivable_id and private.project_in_current_scope(r.project_id)
  )
$$;

alter table public.receivables enable row level security;
alter table public.receivables force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_allocations force row level security;

grant select on public.receivables, public.payments, public.payment_allocations to authenticated;
create policy receivables_read_scoped on public.receivables for select to authenticated using (private.project_in_current_scope(project_id));
create policy payments_read_scoped on public.payments for select to authenticated using (private.client_in_current_scope(client_id));
create policy allocations_read_scoped on public.payment_allocations for select to authenticated using (private.receivable_in_current_scope(receivable_id));

create or replace function private.plan_financial_history_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if old.status = 'active' and new.status = 'archived' then
    if exists(
      select 1 from public.receivables r
      where r.project_installment_id in (select i.id from public.project_installments i where i.payment_plan_id = old.id)
        and r.amount_paid_minor > 0
    ) then
      raise exception 'active plan with financial activity cannot be replaced' using errcode = '55000';
    end if;
    update public.receivables r
    set payment_state = 'cancelled', cancelled_at = now(), cancelled_by = new.activated_by,
        cancellation_reason = 'Plan comercial reemplazado', notifications_enabled = false
    where r.project_installment_id in (select i.id from public.project_installments i where i.payment_plan_id = old.id)
      and r.payment_state = 'open' and r.amount_paid_minor = 0;
  end if;
  return new;
end;
$$;
create trigger payment_plan_financial_history_guard
before update of status on public.project_payment_plans
for each row execute function private.plan_financial_history_guard();

create or replace function private.materialize_plan_receivables()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_project public.projects%rowtype;
  v_actor_email text;
  v_event_id uuid;
begin
  if new.status <> 'active' or old.status = 'active' then return new; end if;
  select * into v_project from public.projects where id = new.project_id for update;
  if exists(select 1 from public.project_installments where payment_plan_id = new.id and due_date is null) then
    raise exception 'every active installment requires a due date' using errcode = '23514';
  end if;
  insert into public.receivables(
    client_id, project_id, origin_type, project_installment_id, description,
    amount_due_minor, currency, due_date, due_time, due_timezone, due_at,
    schedule_version, notifications_enabled, created_by, metadata
  )
  select v_project.client_id, v_project.id, 'project_installment', i.id, i.label,
    i.amount_minor, i.currency, i.due_date, i.due_time, i.due_timezone, i.due_at,
    i.schedule_version, true, new.activated_by,
    jsonb_build_object('paymentPlanId', new.id, 'paymentPlanVersion', new.version)
  from public.project_installments i where i.payment_plan_id = new.id
  on conflict(project_installment_id) where project_installment_id is not null do nothing;

  if (select count(*) from public.receivables r join public.project_installments i on i.id = r.project_installment_id where i.payment_plan_id = new.id)
     <> (select count(*) from public.project_installments i where i.payment_plan_id = new.id) then
    raise exception 'plan receivable materialization incomplete' using errcode = '23514';
  end if;

  select email into v_actor_email from public.profiles where id = new.activated_by;
  for v_event_id in
    select r.id from public.receivables r join public.project_installments i on i.id = r.project_installment_id where i.payment_plan_id = new.id
  loop
    insert into public.activity_logs(id, firebase_id, entity_type, entity_id, client_id, project_id, receivable_id, actor_id, actor_email, recipient_id, action, title, description, after_data, created_at)
    values(gen_random_uuid(), 'supabase:' || gen_random_uuid()::text, 'receivable', v_event_id::text, v_project.client_id, v_project.id, v_event_id,
      new.activated_by, coalesce(v_actor_email, 'system'), coalesce(v_project.assigned_to, new.activated_by), 'receivable_created', 'Cuenta por cobrar creada',
      'La activación del plan creó una obligación financiera.', jsonb_build_object('paymentPlanId', new.id), now());
  end loop;
  return new;
end;
$$;
create trigger payment_plan_materialize_receivables
after update of status on public.project_payment_plans
for each row execute function private.materialize_plan_receivables();

create or replace function private.financial_internal_notification(p_type text, p_client_id uuid, p_receivable_id uuid, p_payment_id uuid, p_title text, p_message text, p_action_url text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare v_profile record; v_id uuid;
begin
  for v_profile in
    select distinct p.id, p.email, p.name
    from public.profiles p
    left join public.clients c on c.id = p_client_id
    where p.active and (p.role in ('owner','admin') or p.id = c.assigned_to)
  loop
    v_id := gen_random_uuid();
    insert into public.notifications(id, firebase_id, recipient_id, recipient_name, recipient_email, type, severity, title, message, action_url, is_read, receivable_id, payment_id, legacy_data, created_at, updated_at)
    values(v_id, 'supabase:' || v_id::text, v_profile.id, v_profile.name, v_profile.email, p_type,
      case when p_type = 'payment_overdue' then 'warning'::public.notification_severity else 'success'::public.notification_severity end,
      p_title, p_message, p_action_url, false, p_receivable_id, p_payment_id, '{}'::jsonb, now(), now());
  end loop;
end;
$$;

create or replace function public.financial_write(p_operation text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_actor public.profiles%rowtype;
  v_payment public.payments%rowtype;
  v_receivable public.receivables%rowtype;
  v_allocation public.payment_allocations%rowtype;
  v_item jsonb;
  v_payment_id uuid;
  v_receivable_id uuid;
  v_amount bigint;
  v_sum bigint := 0;
  v_client_id uuid;
  v_currency text;
  v_event_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid financial payload' using errcode = '22023'; end if;
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found then raise exception 'active profile required' using errcode = '42501'; end if;
  if v_actor.role not in ('owner','admin') then raise exception 'financial mutation forbidden' using errcode = '42501'; end if;

  if p_operation = 'payment_post' then
    if jsonb_typeof(coalesce(p_payload->'allocations','[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(p_payload->'allocations','[]'::jsonb)) not between 1 and 100 then
      raise exception 'invalid payment allocations' using errcode = '22023';
    end if;
    if (select count(*) from jsonb_array_elements(p_payload->'allocations')) <>
       (select count(distinct value->>'receivableId') from jsonb_array_elements(p_payload->'allocations')) then
      raise exception 'duplicate receivable allocation' using errcode = '22023';
    end if;
    v_amount := (p_payload->>'amountMinor')::bigint;
    v_client_id := (p_payload->>'clientId')::uuid;
    v_currency := upper(p_payload->>'currency');
    if v_amount <= 0 or v_currency !~ '^[A-Z]{3}$' then raise exception 'invalid payment amount or currency' using errcode = '22023'; end if;

    perform 1 from public.receivables r
    where r.id in (select (value->>'receivableId')::uuid from jsonb_array_elements(p_payload->'allocations'))
    order by r.id for update;

    for v_item in select value from jsonb_array_elements(p_payload->'allocations') loop
      v_receivable_id := (v_item->>'receivableId')::uuid;
      select * into v_receivable from public.receivables where id = v_receivable_id;
      if not found or v_receivable.payment_state in ('paid','cancelled') then raise exception 'receivable unavailable' using errcode = '22023'; end if;
      if v_receivable.client_id <> v_client_id then raise exception 'cross-client allocation rejected' using errcode = '23514'; end if;
      if v_receivable.currency <> v_currency then raise exception 'cross-currency allocation rejected' using errcode = '23514'; end if;
      if v_receivable.project_id is null then raise exception 'receivable project missing' using errcode = '23514'; end if;
      v_sum := v_sum + (v_item->>'amountMinor')::bigint;
      if (v_item->>'amountMinor')::bigint <= 0 or (v_item->>'amountMinor')::bigint > v_receivable.balance_minor then
        raise exception 'allocation exceeds outstanding balance' using errcode = '23514';
      end if;
    end loop;
    if v_sum <> v_amount then raise exception 'allocation sum must equal payment amount' using errcode = '23514'; end if;

    v_payment_id := gen_random_uuid();
    insert into public.payments(id, client_id, currency, amount_minor, paid_at, method, reference, notes, recorded_by, notify_client)
    values(v_payment_id, v_client_id, v_currency, v_amount, (p_payload->>'paidAt')::timestamptz,
      (p_payload->>'method')::public.payment_method, coalesce(p_payload->>'reference',''), coalesce(p_payload->>'notes',''), v_actor.id,
      coalesce((p_payload->>'notifyClient')::boolean, false));

    for v_item in select value from jsonb_array_elements(p_payload->'allocations') loop
      v_receivable_id := (v_item->>'receivableId')::uuid;
      v_amount := (v_item->>'amountMinor')::bigint;
      insert into public.payment_allocations(payment_id, receivable_id, amount_minor, created_by)
      values(v_payment_id, v_receivable_id, v_amount, v_actor.id);
      update public.receivables set amount_paid_minor = amount_paid_minor + v_amount,
        payment_state = case when amount_paid_minor + v_amount = amount_due_minor then 'paid'::public.receivable_payment_state else 'partially_paid'::public.receivable_payment_state end
      where id = v_receivable_id returning * into v_receivable;
      v_event_id := gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,payment_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'receivable',v_receivable.id::text,v_receivable.client_id,v_receivable.project_id,v_receivable.id,v_payment_id,v_actor.id,v_actor.email,v_actor.id,
        case when v_receivable.payment_state='paid' then 'receivable_paid' else 'receivable_partially_paid' end,
        case when v_receivable.payment_state='paid' then 'Cuenta por cobrar pagada' else 'Pago parcial registrado' end,
        'Un pago fue aplicado a la cuenta por cobrar.', jsonb_build_object('paymentId',v_payment_id,'allocatedMinor',v_amount,'balanceMinor',v_receivable.balance_minor),now());
      v_event_id := gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,payment_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'payment',v_payment_id::text,v_receivable.client_id,v_receivable.project_id,v_receivable.id,v_payment_id,v_actor.id,v_actor.email,v_actor.id,
        'payment_allocated','Pago asignado','Una parte del pago fue asignada transaccionalmente a una cuenta por cobrar.',
        jsonb_build_object('receivableId',v_receivable.id,'allocatedMinor',v_amount),now());
    end loop;
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,payment_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'payment',v_payment_id::text,v_client_id,v_payment_id,v_actor.id,v_actor.email,v_actor.id,'payment_recorded','Pago registrado','Un Owner o Admin registró dinero recibido.',jsonb_build_object('amountMinor',(p_payload->>'amountMinor')::bigint,'currency',v_currency),now());
    perform private.financial_internal_notification('payment_received',v_client_id,null,v_payment_id,'Pago recibido','Se registró un pago de cliente.','/admin/pagos/'||v_payment_id::text);
    return jsonb_build_object('id',v_payment_id,'status','posted','amountMinor',(p_payload->>'amountMinor')::bigint);

  elsif p_operation = 'payment_reverse' then
    v_payment_id := (p_payload->>'id')::uuid;
    select * into v_payment from public.payments where id = v_payment_id for update;
    if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
    if v_payment.status = 'reversed' then return jsonb_build_object('id',v_payment.id,'status','reversed','changed',false); end if;
    if length(btrim(coalesce(p_payload->>'reason',''))) < 3 then raise exception 'reversal reason required' using errcode = '22023'; end if;
    perform 1 from public.receivables r where r.id in (select a.receivable_id from public.payment_allocations a where a.payment_id=v_payment.id and a.reversed_at is null) order by r.id for update;
    for v_allocation in select * from public.payment_allocations where payment_id=v_payment.id and reversed_at is null order by receivable_id loop
      update public.payment_allocations set reversed_at=now(),reversed_by=v_actor.id where id=v_allocation.id;
      update public.receivables set amount_paid_minor=amount_paid_minor-v_allocation.amount_minor,
        payment_state=case when amount_paid_minor-v_allocation.amount_minor=0 then 'open'::public.receivable_payment_state else 'partially_paid'::public.receivable_payment_state end,
        schedule_version=schedule_version+1
      where id=v_allocation.receivable_id returning * into v_receivable;
      if v_receivable.amount_paid_minor < 0 then raise exception 'reversal would create negative paid amount' using errcode='23514'; end if;
    end loop;
    update public.payments set status='reversed',reversed_at=now(),reversed_by=v_actor.id,reversal_reason=btrim(p_payload->>'reason') where id=v_payment.id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,payment_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'payment',v_payment.id::text,v_payment.client_id,v_payment.id,v_actor.id,v_actor.email,v_actor.id,'payment_reversed','Pago revertido','Un Owner o Admin revirtió el pago sin borrar su historial.',to_jsonb(v_payment),jsonb_build_object('reason',btrim(p_payload->>'reason')),now());
    return jsonb_build_object('id',v_payment.id,'status','reversed','changed',true);

  elsif p_operation = 'receivable_cancel' then
    v_receivable_id := (p_payload->>'id')::uuid;
    select * into v_receivable from public.receivables where id=v_receivable_id for update;
    if not found then raise exception 'receivable not found' using errcode='P0002'; end if;
    if v_receivable.payment_state='cancelled' then return jsonb_build_object('id',v_receivable.id,'status','cancelled','changed',false); end if;
    if v_receivable.amount_paid_minor<>0 then raise exception 'receivable with financial activity cannot be cancelled' using errcode='55000'; end if;
    if length(btrim(coalesce(p_payload->>'reason','')))<3 then raise exception 'cancellation reason required' using errcode='22023'; end if;
    update public.receivables set payment_state='cancelled',cancelled_at=now(),cancelled_by=v_actor.id,cancellation_reason=btrim(p_payload->>'reason'),notifications_enabled=false where id=v_receivable.id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'receivable',v_receivable.id::text,v_receivable.client_id,v_receivable.project_id,v_receivable.id,v_actor.id,v_actor.email,v_actor.id,'receivable_cancelled','Cuenta por cobrar cancelada','Un Owner o Admin canceló la obligación sin borrar historial.',jsonb_build_object('reason',btrim(p_payload->>'reason')),now());
    return jsonb_build_object('id',v_receivable.id,'status','cancelled','changed',true);

  elsif p_operation = 'client_billing_settings_update' then
    select jsonb_build_object('id',c.id,'assigned_to',c.assigned_to,'billing_email',c.billing_email,
      'billing_notifications_enabled',c.billing_notifications_enabled,'payment_confirmation_enabled',c.payment_confirmation_enabled,
      'billing_locale',c.billing_locale,'billing_timezone',c.billing_timezone) into v_item
    from public.clients c where c.id=(p_payload->>'clientId')::uuid for update;
    if not found then raise exception 'client not found' using errcode='P0002'; end if;
    if lower(btrim(coalesce(p_payload->>'billingEmail','')))<>'' and lower(btrim(p_payload->>'billingEmail')) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'invalid billing email' using errcode='22023';
    end if;
    if p_payload->>'locale' not in ('es','en') or p_payload->>'timezone'<>'America/Tegucigalpa' then
      raise exception 'invalid billing locale or timezone' using errcode='22023';
    end if;
    update public.clients set billing_email=lower(btrim(coalesce(p_payload->>'billingEmail',''))),
      billing_notifications_enabled=(p_payload->>'billingNotificationsEnabled')::boolean,
      payment_confirmation_enabled=(p_payload->>'paymentConfirmationEnabled')::boolean,
      billing_locale=p_payload->>'locale',billing_timezone=p_payload->>'timezone'
    where id=(p_payload->>'clientId')::uuid;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'client',p_payload->>'clientId',(p_payload->>'clientId')::uuid,v_actor.id,v_actor.email,coalesce((v_item->>'assigned_to')::uuid,v_actor.id),
      'client_billing_settings_updated','Preferencias de cobro actualizadas','Un Owner o Admin actualizó las preferencias transaccionales del cliente.',
      jsonb_build_object('notificationsEnabled',v_item->'billing_notifications_enabled','paymentConfirmationEnabled',v_item->'payment_confirmation_enabled','locale',v_item->'billing_locale'),
      jsonb_build_object('notificationsEnabled',(p_payload->>'billingNotificationsEnabled')::boolean,'paymentConfirmationEnabled',(p_payload->>'paymentConfirmationEnabled')::boolean,'locale',p_payload->>'locale'),now());
    return jsonb_build_object('id',p_payload->>'clientId','changed',true);
  end if;
  raise exception 'unsupported financial operation' using errcode='22023';
end;
$$;

revoke all on function public.financial_write(text,jsonb) from public,anon;
grant execute on function public.financial_write(text,jsonb) to authenticated;

create or replace view public.project_financial_summary
with (security_invoker = true)
as
select p.id as project_id, p.client_id, p.total_amount_minor, p.currency,
  coalesce(sum(r.amount_paid_minor) filter (where r.origin_type='project_installment' and r.payment_state<>'cancelled'),0)::bigint as paid_minor,
  (p.total_amount_minor-coalesce(sum(r.amount_paid_minor) filter (where r.origin_type='project_installment' and r.payment_state<>'cancelled'),0))::bigint as outstanding_minor
from public.projects p
left join public.receivables r on r.project_id=p.id
group by p.id,p.client_id,p.total_amount_minor,p.currency;
grant select on public.project_financial_summary to authenticated;

create or replace function public.billing_list_receivables(
  p_page integer default 1,
  p_page_size integer default 20,
  p_payment_state text default null,
  p_timing_state text default null,
  p_origin_type text default null,
  p_currency text default null,
  p_client_id uuid default null,
  p_project_id uuid default null
)
returns table(
  id uuid,client_id uuid,client_name text,project_id uuid,project_name text,seller_id uuid,
  origin_type text,description text,amount_due_minor bigint,amount_paid_minor bigint,balance_minor bigint,currency text,
  due_date date,due_time time without time zone,due_at timestamptz,payment_state text,timing_state text,
  notifications_enabled boolean,total_count bigint
)
language sql stable security invoker set search_path=pg_catalog as $$
  with visible as (
    select r.*,coalesce(nullif(c.company,''),c.name) as client_name,p.name as project_name,p.assigned_to as seller_id,
      case
        when r.payment_state in ('paid','cancelled') then 'settled'
        when r.due_date<(now() at time zone 'America/Tegucigalpa')::date then 'overdue'
        when r.due_date=(now() at time zone 'America/Tegucigalpa')::date then 'due_today'
        else 'upcoming'
      end as timing_state
    from public.receivables r
    join public.clients c on c.id=r.client_id
    join public.projects p on p.id=r.project_id
  ), filtered as (
    select * from visible v
    where (nullif(p_payment_state,'') is null or v.payment_state::text=p_payment_state)
      and (nullif(p_timing_state,'') is null or v.timing_state=p_timing_state)
      and (nullif(p_origin_type,'') is null or v.origin_type::text=p_origin_type)
      and (nullif(p_currency,'') is null or v.currency=upper(p_currency))
      and (p_client_id is null or v.client_id=p_client_id)
      and (p_project_id is null or v.project_id=p_project_id)
  )
  select f.id,f.client_id,f.client_name,f.project_id,f.project_name,f.seller_id,f.origin_type::text,f.description,
    f.amount_due_minor,f.amount_paid_minor,f.balance_minor,f.currency,f.due_date,f.due_time,f.due_at,
    f.payment_state::text,f.timing_state,f.notifications_enabled,count(*) over()::bigint
  from filtered f order by f.due_date,f.id
  limit least(greatest(p_page_size,1),50)
  offset ((greatest(p_page,1)-1)*least(greatest(p_page_size,1),50));
$$;
revoke all on function public.billing_list_receivables(integer,integer,text,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.billing_list_receivables(integer,integer,text,text,text,text,uuid,uuid) to authenticated;

comment on table public.receivables is 'Real client obligations. Payment state is stored; timing state is derived from Honduras civil due data.';
comment on table public.payments is 'Real money received. Posted payments are reversed, never hard-deleted.';
comment on table public.payment_allocations is 'Immutable many-to-many payment allocation history; reversal marks rows instead of deleting them.';
