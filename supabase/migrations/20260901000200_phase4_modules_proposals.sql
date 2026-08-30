-- Phase 4: modules, versioned proposals, immutable add-on sales and custom payment plans.
create type public.add_on_commercial_status as enum ('requested','quoting','proposal_sent','approved','rejected','cancelled');
create type public.add_on_work_status as enum ('pending','scheduled','in_progress','ready','delivered');
create type public.add_on_proposal_status as enum ('draft','sent','accepted','rejected','expired','superseded','cancelled');
create type public.add_on_plan_status as enum ('draft','active','archived','cancelled');
create type public.add_on_recurring_status as enum ('draft','active','paused','cancelled');

create sequence public.add_on_proposal_number_seq;

create or replace function private.next_add_on_proposal_number()
returns text language sql volatile security definer set search_path=pg_catalog as $$
  select 'KC-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.add_on_proposal_number_seq')::text,6,'0')
$$;

create table public.project_add_ons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  description text not null default '',
  request_date date not null default current_date,
  requested_by_client boolean not null default true,
  commercial_status public.add_on_commercial_status not null default 'requested',
  work_status public.add_on_work_status not null default 'pending',
  quoted_amount_minor bigint check (quoted_amount_minor is null or quoted_amount_minor > 0),
  accepted_amount_minor bigint check (accepted_amount_minor is null or accepted_amount_minor > 0),
  currency text not null default 'USD',
  accepted_proposal_id uuid,
  assigned_sales_agent_id uuid references public.profiles(id) on delete restrict,
  effective_date date,
  planned_start_date date,
  target_delivery_date date,
  actual_delivery_date date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  rejected_at timestamptz,
  rejection_reason text not null default '',
  cancelled_at timestamptz,
  cancellation_reason text not null default '',
  delivered_at timestamptz,
  delivered_by uuid references public.profiles(id) on delete restrict,
  delivery_notes text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_add_ons_name_valid check (length(btrim(name)) between 2 and 180),
  constraint project_add_ons_currency_usd check (currency='USD'),
  constraint project_add_ons_dates_valid check (target_delivery_date is null or planned_start_date is null or target_delivery_date>=planned_start_date),
  constraint project_add_ons_approval_valid check ((commercial_status='approved' and accepted_amount_minor is not null and approved_at is not null and approved_by is not null) or commercial_status<>'approved'),
  constraint project_add_ons_rejection_valid check ((commercial_status='rejected' and rejected_at is not null and length(btrim(rejection_reason))>0) or commercial_status<>'rejected'),
  constraint project_add_ons_cancellation_valid check ((commercial_status='cancelled' and cancelled_at is not null and length(btrim(cancellation_reason))>0) or commercial_status<>'cancelled'),
  constraint project_add_ons_delivery_valid check ((work_status='delivered' and delivered_at is not null and delivered_by is not null and actual_delivery_date is not null) or work_status<>'delivered')
);

create table public.add_on_proposals (
  id uuid primary key default gen_random_uuid(),
  add_on_id uuid not null references public.project_add_ons(id) on delete restrict,
  proposal_number text not null unique default private.next_add_on_proposal_number(),
  version integer not null check (version>0),
  status public.add_on_proposal_status not null default 'draft',
  title text not null,
  scope_description text not null,
  amount_minor bigint not null check (amount_minor>0),
  currency text not null default 'USD',
  payment_terms text not null default '',
  monthly_add_on_minor bigint not null default 0 check (monthly_add_on_minor>=0),
  estimated_delivery text not null default '',
  valid_until date,
  client_notes text not null default '',
  internal_notes text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  sent_at timestamptz,
  sent_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete restrict,
  decision_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(add_on_id,version),
  constraint add_on_proposals_title_valid check (length(btrim(title)) between 2 and 180),
  constraint add_on_proposals_scope_valid check (length(btrim(scope_description)) between 2 and 12000),
  constraint add_on_proposals_currency_usd check (currency='USD'),
  constraint add_on_proposals_sent_valid check ((status='sent' and sent_at is not null and sent_by is not null) or status<>'sent'),
  constraint add_on_proposals_decision_valid check ((status in ('accepted','rejected') and decided_at is not null and decided_by is not null) or status not in ('accepted','rejected'))
);

alter table public.project_add_ons add constraint project_add_ons_accepted_proposal_fk
  foreign key(accepted_proposal_id) references public.add_on_proposals(id) on delete restrict;

create table public.add_on_sales (
  id uuid primary key default gen_random_uuid(),
  add_on_id uuid not null unique references public.project_add_ons(id) on delete restrict,
  proposal_id uuid not null unique references public.add_on_proposals(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  accepted_amount_minor bigint not null check (accepted_amount_minor>0),
  currency text not null default 'USD',
  seller_id uuid references public.profiles(id) on delete restrict,
  effective_date date not null,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint add_on_sales_currency_usd check (currency='USD')
);

create table public.add_on_payment_plans (
  id uuid primary key default gen_random_uuid(),
  add_on_sale_id uuid not null references public.add_on_sales(id) on delete restrict,
  version integer not null check (version>0),
  name text not null default 'Plan de ampliacion',
  status public.add_on_plan_status not null default 'draft',
  planned_total_minor bigint not null check (planned_total_minor>0),
  currency text not null default 'USD',
  created_by uuid not null references public.profiles(id) on delete restrict,
  activated_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(add_on_sale_id,version),
  constraint add_on_payment_plans_currency_usd check (currency='USD'),
  constraint add_on_payment_plans_activation_valid check ((status='active' and activated_by is not null and activated_at is not null) or status<>'active')
);
create unique index add_on_payment_plans_one_active_idx on public.add_on_payment_plans(add_on_sale_id) where status='active';

create table public.add_on_installments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.add_on_payment_plans(id) on delete cascade,
  sequence integer not null check (sequence>0),
  label text not null,
  amount_minor bigint not null check (amount_minor>0),
  currency text not null default 'USD',
  due_date date not null,
  due_time time without time zone,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_plan_id,sequence),
  constraint add_on_installments_currency_usd check (currency='USD'),
  constraint add_on_installments_label_valid check (length(btrim(label)) between 1 and 140)
);

create table public.add_on_recurring_services (
  id uuid primary key default gen_random_uuid(),
  add_on_sale_id uuid not null references public.add_on_sales(id) on delete restrict,
  name text not null,
  monthly_amount_minor bigint not null check (monthly_amount_minor>0),
  currency text not null default 'USD',
  start_date date not null,
  billing_day smallint not null check (billing_day between 1 and 28),
  billing_time time without time zone not null default '09:00',
  timezone text not null default 'America/Tegucigalpa',
  status public.add_on_recurring_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint add_on_recurring_currency_usd check (currency='USD'),
  constraint add_on_recurring_timezone_valid check (timezone='America/Tegucigalpa'),
  constraint add_on_recurring_name_valid check (length(btrim(name)) between 2 and 140)
);
create unique index add_on_recurring_one_live_idx on public.add_on_recurring_services(add_on_sale_id) where status in ('draft','active','paused');

create table public.add_on_seller_assignment_events (
  id uuid primary key default gen_random_uuid(),
  add_on_id uuid not null references public.project_add_ons(id) on delete restrict,
  previous_seller_id uuid references public.profiles(id) on delete set null,
  new_seller_id uuid references public.profiles(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_email text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.receivables
  add column add_on_installment_id uuid references public.add_on_installments(id) on delete restrict,
  add column add_on_recurring_service_id uuid references public.add_on_recurring_services(id) on delete restrict;
alter table public.receivables drop constraint receivable_origin_valid;
alter table public.receivables add constraint receivable_origin_valid check (
  (origin_type='project_installment' and project_installment_id is not null and recurring_service_id is null and add_on_installment_id is null and add_on_recurring_service_id is null and recurring_period_key is null)
  or (origin_type='recurring_service' and project_installment_id is null and recurring_service_id is not null and add_on_installment_id is null and add_on_recurring_service_id is null and length(btrim(recurring_period_key)) between 4 and 24)
  or (origin_type='add_on_installment' and project_installment_id is null and recurring_service_id is null and add_on_installment_id is not null and add_on_recurring_service_id is null and recurring_period_key is null)
  or (origin_type='add_on_recurring' and project_installment_id is null and recurring_service_id is null and add_on_installment_id is null and add_on_recurring_service_id is not null and length(btrim(recurring_period_key)) between 4 and 24)
);
create unique index receivables_add_on_installment_origin_idx on public.receivables(add_on_installment_id) where add_on_installment_id is not null;
create unique index receivables_add_on_recurring_period_idx on public.receivables(add_on_recurring_service_id,recurring_period_key) where add_on_recurring_service_id is not null;

alter table public.activity_logs
  add column add_on_id uuid references public.project_add_ons(id) on delete restrict,
  add column add_on_proposal_id uuid references public.add_on_proposals(id) on delete restrict,
  add column add_on_sale_id uuid references public.add_on_sales(id) on delete restrict;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check (entity_type in (
  'lead','note','task','notification','user','system','client','project','payment_plan','recurring_service','receivable','payment','billing','expense','expense_category','finance_report','module','proposal','add_on_sale','add_on_payment_plan','add_on_recurring'
));
alter table public.notifications add column add_on_id uuid references public.project_add_ons(id) on delete restrict;
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in (
  'lead','task','lead_new','lead_status_changed','lead_priority_changed','note_added','task_created','task_updated','task_completed','task_reminder','task_due','task_overdue','system','payment_due_7_days','payment_due_3_days','payment_due_today','payment_overdue','payment_received','module'
));

create index project_add_ons_scope_idx on public.project_add_ons(client_id,project_id,updated_at desc);
create index project_add_ons_seller_status_idx on public.project_add_ons(assigned_sales_agent_id,commercial_status,work_status);
create index add_on_proposals_add_on_version_idx on public.add_on_proposals(add_on_id,version desc);
create index add_on_sales_effective_idx on public.add_on_sales(effective_date,seller_id);
create index add_on_installments_plan_sequence_idx on public.add_on_installments(payment_plan_id,sequence);
create index add_on_seller_events_idx on public.add_on_seller_assignment_events(add_on_id,created_at desc);

create trigger project_add_ons_updated_at before update on public.project_add_ons for each row execute function private.set_updated_at();
create trigger add_on_proposals_updated_at before update on public.add_on_proposals for each row execute function private.set_updated_at();
create trigger add_on_payment_plans_updated_at before update on public.add_on_payment_plans for each row execute function private.set_updated_at();
create trigger add_on_installments_updated_at before update on public.add_on_installments for each row execute function private.set_updated_at();
create trigger add_on_recurring_updated_at before update on public.add_on_recurring_services for each row execute function private.set_updated_at();

create or replace function private.add_on_integrity_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_client uuid;
begin
  select client_id into v_client from public.projects where id=new.project_id;
  if v_client is null or v_client<>new.client_id then raise exception 'module client and project must match' using errcode='23514'; end if;
  if new.currency<>'USD' then raise exception 'module currency must be USD' using errcode='23514'; end if;
  return new;
end $$;
create trigger project_add_ons_integrity before insert or update on public.project_add_ons for each row execute function private.add_on_integrity_guard();

create or replace function private.accepted_proposal_immutable()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.status in ('accepted','rejected','expired','superseded','cancelled') then raise exception 'historical proposal terms are immutable' using errcode='55000'; end if;
  return new;
end $$;
create trigger add_on_proposals_immutable before update on public.add_on_proposals for each row execute function private.accepted_proposal_immutable();
create trigger add_on_sales_no_update before update or delete on public.add_on_sales for each row execute function private.block_financial_delete();

create or replace function private.add_on_in_current_scope(p_add_on_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.project_add_ons a where a.id=p_add_on_id and private.project_in_current_scope(a.project_id))
$$;
create or replace function private.add_on_sale_in_current_scope(p_sale_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.add_on_sales s where s.id=p_sale_id and private.add_on_in_current_scope(s.add_on_id))
$$;

alter table public.project_add_ons enable row level security; alter table public.project_add_ons force row level security;
alter table public.add_on_proposals enable row level security; alter table public.add_on_proposals force row level security;
alter table public.add_on_sales enable row level security; alter table public.add_on_sales force row level security;
alter table public.add_on_payment_plans enable row level security; alter table public.add_on_payment_plans force row level security;
alter table public.add_on_installments enable row level security; alter table public.add_on_installments force row level security;
alter table public.add_on_recurring_services enable row level security; alter table public.add_on_recurring_services force row level security;
alter table public.add_on_seller_assignment_events enable row level security; alter table public.add_on_seller_assignment_events force row level security;

grant select on public.project_add_ons,public.add_on_proposals,public.add_on_sales,public.add_on_payment_plans,public.add_on_installments,public.add_on_recurring_services,public.add_on_seller_assignment_events to authenticated;
grant usage,select on sequence public.add_on_proposal_number_seq to authenticated;

create policy add_ons_read_scoped on public.project_add_ons for select to authenticated using (private.project_in_current_scope(project_id));
create policy proposals_read_scoped on public.add_on_proposals for select to authenticated using (private.add_on_in_current_scope(add_on_id));
create policy sales_read_scoped on public.add_on_sales for select to authenticated using (private.add_on_in_current_scope(add_on_id));
create policy add_on_plans_read_scoped on public.add_on_payment_plans for select to authenticated using (private.add_on_sale_in_current_scope(add_on_sale_id));
create policy add_on_installments_read_scoped on public.add_on_installments for select to authenticated using (exists(select 1 from public.add_on_payment_plans p where p.id=payment_plan_id and private.add_on_sale_in_current_scope(p.add_on_sale_id)));
create policy add_on_recurring_read_scoped on public.add_on_recurring_services for select to authenticated using (private.add_on_sale_in_current_scope(add_on_sale_id));
create policy add_on_seller_events_read_scoped on public.add_on_seller_assignment_events for select to authenticated using (private.add_on_in_current_scope(add_on_id));

create or replace function private.phase4_activity(p_entity_type text,p_entity_id uuid,p_client_id uuid,p_project_id uuid,p_add_on_id uuid,p_proposal_id uuid,p_sale_id uuid,p_action text,p_title text,p_description text,p_before jsonb,p_after jsonb,p_actor public.profiles)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid:=gen_random_uuid();
begin
  insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,add_on_id,add_on_proposal_id,add_on_sale_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
  values(v_id,'supabase:'||v_id::text,p_entity_type,p_entity_id::text,p_client_id,p_project_id,p_add_on_id,p_proposal_id,p_sale_id,p_actor.id,p_actor.email,p_actor.id,p_action,p_title,p_description,p_before,p_after,now());
end $$;

create or replace function public.add_on_write(p_operation text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor public.profiles%rowtype; v_add_on public.project_add_ons%rowtype; v_proposal public.add_on_proposals%rowtype; v_sale public.add_on_sales%rowtype; v_plan public.add_on_payment_plans%rowtype;
  v_project public.projects%rowtype; v_id uuid; v_proposal_id uuid; v_sale_id uuid; v_plan_id uuid; v_seller uuid; v_version integer; v_sum bigint:=0; v_item jsonb; v_status text; v_notification_id uuid;
begin
  select * into v_actor from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'active profile required' using errcode='42501'; end if;

  if p_operation='module_create' then
    if v_actor.role not in ('owner','admin','sales_agent') then raise exception 'module creation forbidden' using errcode='42501'; end if;
    if coalesce(p_payload->>'currency','USD')<>'USD' then raise exception 'module currency must be USD' using errcode='23514'; end if;
    select * into v_project from public.projects where id=(p_payload->>'projectId')::uuid;
    if not found or v_project.client_id<>(p_payload->>'clientId')::uuid then raise exception 'invalid client project relationship' using errcode='23514'; end if;
    if v_actor.role='sales_agent' and v_project.assigned_to is distinct from v_actor.id and not exists(select 1 from public.clients c where c.id=v_project.client_id and c.assigned_to=v_actor.id) then raise exception 'module creation forbidden' using errcode='42501'; end if;
    v_seller:=case when v_actor.role='sales_agent' then v_actor.id else coalesce(nullif(p_payload->>'sellerId','')::uuid,v_project.assigned_to) end;
    v_id:=gen_random_uuid();
    insert into public.project_add_ons(id,project_id,client_id,name,description,request_date,requested_by_client,currency,assigned_sales_agent_id,created_by,notes)
    values(v_id,v_project.id,v_project.client_id,btrim(p_payload->>'name'),coalesce(p_payload->>'description',''),coalesce(nullif(p_payload->>'requestDate','')::date,current_date),coalesce((p_payload->>'requestedByClient')::boolean,true),'USD',v_seller,v_actor.id,coalesce(p_payload->>'notes',''));
    perform private.phase4_activity('module',v_id,v_project.client_id,v_project.id,v_id,null,null,'module_created','Modulo creado','Se registro una nueva ampliacion comercial.',null,jsonb_build_object('name',p_payload->>'name'),v_actor);
    return jsonb_build_object('id',v_id);

  elsif p_operation='proposal_create' then
    select * into v_add_on from public.project_add_ons where id=(p_payload->>'addOnId')::uuid for update;
    if not found then raise exception 'module not found' using errcode='P0002'; end if;
    if v_actor.role not in ('owner','admin') and not (v_actor.role='sales_agent' and v_add_on.assigned_sales_agent_id=v_actor.id) then raise exception 'proposal creation forbidden' using errcode='42501'; end if;
    if coalesce(p_payload->>'currency','USD')<>'USD' then raise exception 'proposal currency must be USD' using errcode='23514'; end if;
    select coalesce(max(version),0)+1 into v_version from public.add_on_proposals where add_on_id=v_add_on.id;
    update public.add_on_proposals set status='superseded' where add_on_id=v_add_on.id and status in ('draft','sent');
    v_proposal_id:=gen_random_uuid();
    insert into public.add_on_proposals(id,add_on_id,version,title,scope_description,amount_minor,currency,payment_terms,monthly_add_on_minor,estimated_delivery,valid_until,client_notes,internal_notes,created_by)
    values(v_proposal_id,v_add_on.id,v_version,btrim(p_payload->>'title'),btrim(p_payload->>'scope'),(p_payload->>'amountMinor')::bigint,'USD',coalesce(p_payload->>'paymentTerms',''),coalesce(nullif(p_payload->>'monthlyAddOnMinor','')::bigint,0),coalesce(p_payload->>'estimatedDelivery',''),nullif(p_payload->>'validUntil','')::date,coalesce(p_payload->>'clientNotes',''),coalesce(p_payload->>'internalNotes',''),v_actor.id);
    update public.project_add_ons set commercial_status='quoting',quoted_amount_minor=(p_payload->>'amountMinor')::bigint where id=v_add_on.id;
    perform private.phase4_activity('proposal',v_proposal_id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,v_proposal_id,null,'proposal_created','Propuesta creada','Se creo una nueva version de propuesta.',null,jsonb_build_object('version',v_version),v_actor);
    return jsonb_build_object('id',v_proposal_id,'version',v_version);

  elsif p_operation='proposal_update' then
    select p.* into v_proposal from public.add_on_proposals p join public.project_add_ons a on a.id=p.add_on_id where p.id=(p_payload->>'proposalId')::uuid for update of p;
    if not found then raise exception 'proposal not found' using errcode='P0002'; end if;
    select * into v_add_on from public.project_add_ons where id=v_proposal.add_on_id;
    if v_proposal.status<>'draft' then raise exception 'only draft proposals can be edited' using errcode='55000'; end if;
    if v_actor.role not in ('owner','admin') and not (v_actor.role='sales_agent' and v_add_on.assigned_sales_agent_id=v_actor.id) then raise exception 'proposal update forbidden' using errcode='42501'; end if;
    if coalesce(p_payload->>'currency','USD')<>'USD' then raise exception 'proposal currency must be USD' using errcode='23514'; end if;
    update public.add_on_proposals set title=btrim(p_payload->>'title'),scope_description=btrim(p_payload->>'scope'),amount_minor=(p_payload->>'amountMinor')::bigint,payment_terms=coalesce(p_payload->>'paymentTerms',''),monthly_add_on_minor=coalesce(nullif(p_payload->>'monthlyAddOnMinor','')::bigint,0),estimated_delivery=coalesce(p_payload->>'estimatedDelivery',''),valid_until=nullif(p_payload->>'validUntil','')::date,client_notes=coalesce(p_payload->>'clientNotes',''),internal_notes=coalesce(p_payload->>'internalNotes','') where id=v_proposal.id;
    update public.project_add_ons set quoted_amount_minor=(p_payload->>'amountMinor')::bigint where id=v_add_on.id;
    perform private.phase4_activity('proposal',v_proposal.id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,v_proposal.id,null,'proposal_updated','Propuesta actualizada','Se actualizaron los terminos del borrador.',to_jsonb(v_proposal),null,v_actor);
    return jsonb_build_object('id',v_proposal.id);

  elsif p_operation='proposal_mark_sent' then
    if v_actor.role not in ('owner','admin') then raise exception 'proposal sent status forbidden' using errcode='42501'; end if;
    select * into v_proposal from public.add_on_proposals where id=(p_payload->>'proposalId')::uuid for update;
    if not found or v_proposal.status<>'draft' then raise exception 'proposal must be draft' using errcode='55000'; end if;
    select * into v_add_on from public.project_add_ons where id=v_proposal.add_on_id;
    update public.add_on_proposals set status='sent',sent_at=now(),sent_by=v_actor.id where id=v_proposal.id;
    update public.project_add_ons set commercial_status='proposal_sent' where id=v_add_on.id;
    perform private.phase4_activity('proposal',v_proposal.id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,v_proposal.id,null,'proposal_sent','Propuesta enviada','El Owner o Admin marco la propuesta como enviada.',null,null,v_actor);
    return jsonb_build_object('id',v_proposal.id);

  elsif p_operation='proposal_accept' then
    if v_actor.role not in ('owner','admin') then raise exception 'proposal acceptance forbidden' using errcode='42501'; end if;
    select * into v_proposal from public.add_on_proposals where id=(p_payload->>'proposalId')::uuid for update;
    if not found or v_proposal.status not in ('draft','sent') then raise exception 'proposal cannot be accepted' using errcode='55000'; end if;
    select * into v_add_on from public.project_add_ons where id=v_proposal.add_on_id for update;
    if v_add_on.commercial_status='approved' or exists(select 1 from public.add_on_sales where add_on_id=v_add_on.id) then raise exception 'module already approved' using errcode='23505'; end if;
    update public.add_on_proposals set status='accepted',decided_at=now(),decided_by=v_actor.id,decision_notes=coalesce(p_payload->>'decisionNotes','') where id=v_proposal.id;
    update public.add_on_proposals set status='superseded' where add_on_id=v_add_on.id and id<>v_proposal.id and status in ('draft','sent');
    update public.project_add_ons set commercial_status='approved',accepted_amount_minor=v_proposal.amount_minor,accepted_proposal_id=v_proposal.id,effective_date=coalesce(nullif(p_payload->>'effectiveDate','')::date,current_date),approved_at=now(),approved_by=v_actor.id where id=v_add_on.id;
    v_sale_id:=gen_random_uuid();
    insert into public.add_on_sales(id,add_on_id,proposal_id,client_id,project_id,accepted_amount_minor,currency,seller_id,effective_date,approved_by)
    values(v_sale_id,v_add_on.id,v_proposal.id,v_add_on.client_id,v_add_on.project_id,v_proposal.amount_minor,'USD',v_add_on.assigned_sales_agent_id,coalesce(nullif(p_payload->>'effectiveDate','')::date,current_date),v_actor.id);
    perform private.phase4_activity('add_on_sale',v_sale_id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,v_proposal.id,v_sale_id,'module_sale_approved','Ampliacion aprobada','La propuesta fue aceptada y se preservaron sus terminos.',null,jsonb_build_object('amountMinor',v_proposal.amount_minor),v_actor);
    v_notification_id:=gen_random_uuid();
    insert into public.notifications(id,firebase_id,recipient_id,type,severity,title,message,action_url,add_on_id,created_at,updated_at)
    values(v_notification_id,'supabase:'||v_notification_id::text,coalesce(v_add_on.assigned_sales_agent_id,v_actor.id),'module','success','Propuesta aceptada','La ampliacion '||v_add_on.name||' fue aprobada.','/admin/modulos/'||v_add_on.id::text,v_add_on.id,now(),now());
    return jsonb_build_object('addOnId',v_add_on.id,'saleId',v_sale_id);

  elsif p_operation='proposal_reject' then
    if v_actor.role not in ('owner','admin') then raise exception 'proposal rejection forbidden' using errcode='42501'; end if;
    select * into v_proposal from public.add_on_proposals where id=(p_payload->>'proposalId')::uuid for update;
    if not found or v_proposal.status not in ('draft','sent') then raise exception 'proposal cannot be rejected' using errcode='55000'; end if;
    select * into v_add_on from public.project_add_ons where id=v_proposal.add_on_id for update;
    update public.add_on_proposals set status='rejected',decided_at=now(),decided_by=v_actor.id,decision_notes=coalesce(p_payload->>'decisionNotes','') where id=v_proposal.id;
    update public.project_add_ons set commercial_status='rejected',rejected_at=now(),rejection_reason=coalesce(nullif(p_payload->>'decisionNotes',''),'Decision comercial registrada') where id=v_add_on.id;
    perform private.phase4_activity('proposal',v_proposal.id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,v_proposal.id,null,'proposal_rejected','Propuesta rechazada','Se registro la decision del cliente sin generar obligaciones.',null,null,v_actor);
    return jsonb_build_object('id',v_proposal.id);

  elsif p_operation='payment_plan_save' then
    if v_actor.role not in ('owner','admin') then raise exception 'payment plan forbidden' using errcode='42501'; end if;
    select * into v_sale from public.add_on_sales where id=(p_payload->>'saleId')::uuid;
    if not found then raise exception 'add-on sale not found' using errcode='P0002'; end if;
    if coalesce(p_payload->>'currency','USD')<>'USD' then raise exception 'payment plan currency must be USD' using errcode='23514'; end if;
    v_plan_id:=nullif(p_payload->>'planId','')::uuid;
    if v_plan_id is null then
      select coalesce(max(version),0)+1 into v_version from public.add_on_payment_plans where add_on_sale_id=v_sale.id;
      insert into public.add_on_payment_plans(add_on_sale_id,version,name,planned_total_minor,currency,created_by) values(v_sale.id,v_version,coalesce(nullif(p_payload->>'name',''),'Plan de ampliacion'),v_sale.accepted_amount_minor,'USD',v_actor.id) returning id into v_plan_id;
    else
      select * into v_plan from public.add_on_payment_plans where id=v_plan_id and add_on_sale_id=v_sale.id for update;
      if not found or v_plan.status<>'draft' then raise exception 'only draft plan can be edited' using errcode='55000'; end if;
      delete from public.add_on_installments where payment_plan_id=v_plan_id;
    end if;
    if jsonb_typeof(p_payload->'installments')<>'array' or jsonb_array_length(p_payload->'installments')<1 then raise exception 'installments required' using errcode='22023'; end if;
    for v_item in select value from jsonb_array_elements(p_payload->'installments') loop
      if coalesce(v_item->>'currency','USD')<>'USD' then raise exception 'installment currency must be USD' using errcode='23514'; end if;
      insert into public.add_on_installments(payment_plan_id,sequence,label,amount_minor,currency,due_date,due_time,notes)
      values(v_plan_id,(v_item->>'sequence')::integer,btrim(v_item->>'label'),(v_item->>'amountMinor')::bigint,'USD',(v_item->>'dueDate')::date,nullif(v_item->>'dueTime','')::time,coalesce(v_item->>'notes',''));
      v_sum:=v_sum+(v_item->>'amountMinor')::bigint;
    end loop;
    if v_sum<>v_sale.accepted_amount_minor then raise exception 'installment total must equal accepted add-on price' using errcode='23514'; end if;
    perform private.phase4_activity('add_on_payment_plan',v_plan_id,v_sale.client_id,v_sale.project_id,v_sale.add_on_id,v_sale.proposal_id,v_sale.id,'module_payment_plan_created','Plan de pago configurado','Se guardo un plan de cuotas en borrador.',null,jsonb_build_object('totalMinor',v_sum),v_actor);
    return jsonb_build_object('id',v_plan_id,'totalMinor',v_sum);

  elsif p_operation='payment_plan_activate' then
    if v_actor.role not in ('owner','admin') then raise exception 'payment plan activation forbidden' using errcode='42501'; end if;
    select * into v_plan from public.add_on_payment_plans where id=(p_payload->>'planId')::uuid for update;
    if not found or v_plan.status<>'draft' then raise exception 'plan must be draft' using errcode='55000'; end if;
    select * into v_sale from public.add_on_sales where id=v_plan.add_on_sale_id;
    select coalesce(sum(amount_minor),0) into v_sum from public.add_on_installments where payment_plan_id=v_plan.id;
    if v_sum<>v_sale.accepted_amount_minor or v_plan.planned_total_minor<>v_sale.accepted_amount_minor then raise exception 'installment total must equal accepted add-on price' using errcode='23514'; end if;
    if exists(select 1 from public.add_on_payment_plans where add_on_sale_id=v_sale.id and status='active') then raise exception 'active plan already exists' using errcode='23505'; end if;
    update public.add_on_payment_plans set status='active',activated_by=v_actor.id,activated_at=now() where id=v_plan.id;
    insert into public.receivables(client_id,project_id,origin_type,add_on_installment_id,description,amount_due_minor,currency,due_date,due_time,due_timezone,notifications_enabled,created_by,metadata)
    select v_sale.client_id,v_sale.project_id,'add_on_installment',i.id,(select name from public.project_add_ons where id=v_sale.add_on_id)||' - '||i.label,i.amount_minor,'USD',i.due_date,i.due_time,'America/Tegucigalpa',true,v_actor.id,jsonb_build_object('addOnId',v_sale.add_on_id,'saleId',v_sale.id,'planId',v_plan.id)
    from public.add_on_installments i where i.payment_plan_id=v_plan.id
    on conflict(add_on_installment_id) where add_on_installment_id is not null do nothing;
    perform private.phase4_activity('add_on_payment_plan',v_plan.id,v_sale.client_id,v_sale.project_id,v_sale.add_on_id,v_sale.proposal_id,v_sale.id,'module_payment_plan_activated','Plan de pago activado','Las cuotas acordadas generaron obligaciones separadas.',null,jsonb_build_object('receivables',(select count(*) from public.add_on_installments where payment_plan_id=v_plan.id)),v_actor);
    return jsonb_build_object('id',v_plan.id,'activated',true);

  elsif p_operation='recurring_configure' then
    if v_actor.role not in ('owner','admin') then raise exception 'recurring add-on forbidden' using errcode='42501'; end if;
    select * into v_sale from public.add_on_sales where id=(p_payload->>'saleId')::uuid;
    if not found then raise exception 'add-on sale not found' using errcode='P0002'; end if;
    if coalesce(p_payload->>'currency','USD')<>'USD' then raise exception 'recurring currency must be USD' using errcode='23514'; end if;
    v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.add_on_recurring_services(add_on_sale_id,name,monthly_amount_minor,currency,start_date,billing_day,billing_time,timezone,status,created_by,updated_by)
      values(v_sale.id,btrim(p_payload->>'name'),(p_payload->>'monthlyAmountMinor')::bigint,'USD',(p_payload->>'startDate')::date,(p_payload->>'billingDay')::smallint,coalesce(nullif(p_payload->>'billingTime','')::time,'09:00'),'America/Tegucigalpa',coalesce(nullif(p_payload->>'status','')::public.add_on_recurring_status,'draft'),v_actor.id,v_actor.id) returning id into v_id;
    else
      update public.add_on_recurring_services set name=btrim(p_payload->>'name'),monthly_amount_minor=(p_payload->>'monthlyAmountMinor')::bigint,start_date=(p_payload->>'startDate')::date,billing_day=(p_payload->>'billingDay')::smallint,billing_time=coalesce(nullif(p_payload->>'billingTime','')::time,'09:00'),status=coalesce(nullif(p_payload->>'status','')::public.add_on_recurring_status,status),updated_by=v_actor.id where id=v_id and add_on_sale_id=v_sale.id;
      if not found then raise exception 'recurring add-on not found' using errcode='P0002'; end if;
    end if;
    perform private.phase4_activity('add_on_recurring',v_id,v_sale.client_id,v_sale.project_id,v_sale.add_on_id,v_sale.proposal_id,v_sale.id,'module_recurring_charge_configured','Cargo mensual configurado','El componente mensual adicional quedo separado del servicio base.',null,jsonb_build_object('monthlyAmountMinor',(p_payload->>'monthlyAmountMinor')::bigint),v_actor);
    return jsonb_build_object('id',v_id);

  elsif p_operation='work_status_update' then
    if v_actor.role not in ('owner','admin') then raise exception 'module work status forbidden' using errcode='42501'; end if;
    select * into v_add_on from public.project_add_ons where id=(p_payload->>'addOnId')::uuid for update;
    if not found then raise exception 'module not found' using errcode='P0002'; end if;
    v_status:=p_payload->>'status';
    update public.project_add_ons set work_status=v_status::public.add_on_work_status,planned_start_date=coalesce(nullif(p_payload->>'plannedStartDate','')::date,planned_start_date),target_delivery_date=coalesce(nullif(p_payload->>'targetDeliveryDate','')::date,target_delivery_date),actual_delivery_date=case when v_status='delivered' then coalesce(nullif(p_payload->>'actualDeliveryDate','')::date,current_date) else actual_delivery_date end,delivered_at=case when v_status='delivered' then now() else delivered_at end,delivered_by=case when v_status='delivered' then v_actor.id else delivered_by end,delivery_notes=case when v_status='delivered' then coalesce(p_payload->>'notes','') else delivery_notes end where id=v_add_on.id;
    perform private.phase4_activity('module',v_add_on.id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,null,null,case when v_status='delivered' then 'module_delivered' else 'module_status_changed' end,'Estado de ampliacion actualizado','Se actualizo el avance de la ampliacion.',jsonb_build_object('status',v_add_on.work_status),jsonb_build_object('status',v_status),v_actor);
    return jsonb_build_object('id',v_add_on.id);

  elsif p_operation='module_assign' then
    if v_actor.role not in ('owner','admin') then raise exception 'module assignment forbidden' using errcode='42501'; end if;
    select * into v_add_on from public.project_add_ons where id=(p_payload->>'addOnId')::uuid for update;
    if not found then raise exception 'module not found' using errcode='P0002'; end if;
    v_seller:=nullif(p_payload->>'sellerId','')::uuid;
    if v_seller is not null and not exists(select 1 from public.profiles where id=v_seller and active and role='sales_agent') then raise exception 'invalid sales agent' using errcode='22023'; end if;
    insert into public.add_on_seller_assignment_events(add_on_id,previous_seller_id,new_seller_id,actor_id,actor_email,reason) values(v_add_on.id,v_add_on.assigned_sales_agent_id,v_seller,v_actor.id,v_actor.email,coalesce(p_payload->>'reason',''));
    update public.project_add_ons set assigned_sales_agent_id=v_seller where id=v_add_on.id;
    perform private.phase4_activity('module',v_add_on.id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,null,null,case when v_add_on.assigned_sales_agent_id is null then 'module_seller_assigned' else 'module_seller_reassigned' end,'Responsable actualizado','Se preservo el historial de atribucion comercial.',jsonb_build_object('sellerId',v_add_on.assigned_sales_agent_id),jsonb_build_object('sellerId',v_seller),v_actor);
    return jsonb_build_object('id',v_add_on.id);

  elsif p_operation='proposal_exported' then
    if v_actor.role not in ('owner','admin') then raise exception 'proposal export forbidden' using errcode='42501'; end if;
    select * into v_proposal from public.add_on_proposals where id=(p_payload->>'proposalId')::uuid;
    if not found then raise exception 'proposal not found' using errcode='P0002'; end if;
    select * into v_add_on from public.project_add_ons where id=v_proposal.add_on_id;
    perform private.phase4_activity('proposal',v_proposal.id,v_add_on.client_id,v_add_on.project_id,v_add_on.id,v_proposal.id,null,'proposal_exported','Propuesta descargada','Un usuario autorizado genero el PDF comercial.',null,jsonb_build_object('proposalNumber',v_proposal.proposal_number),v_actor);
    return jsonb_build_object('id',v_proposal.id);
  end if;
  raise exception 'unsupported add-on operation' using errcode='22023';
end $$;

revoke all on function private.next_add_on_proposal_number(),private.add_on_in_current_scope(uuid),private.add_on_sale_in_current_scope(uuid),private.phase4_activity(text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,public.profiles) from public,anon,authenticated;
grant execute on function private.add_on_in_current_scope(uuid),private.add_on_sale_in_current_scope(uuid) to authenticated;
revoke all on function public.add_on_write(text,jsonb) from public,anon;
grant execute on function public.add_on_write(text,jsonb) to authenticated;

comment on table public.project_add_ons is 'Additional commercial work kept separate from the immutable original project price.';
comment on table public.add_on_proposals is 'Versioned client proposals with internal notes isolated from client-facing content.';
comment on table public.add_on_sales is 'Immutable accepted commercial terms for an additional sale.';
comment on function public.add_on_write(text,jsonb) is 'Transactional Phase 4 command boundary with explicit role checks and activity history.';
