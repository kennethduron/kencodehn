-- Phase 1: first-class clients, projects and commercial planning (no receivables or payments).
create type public.client_status as enum ('active', 'inactive');
create type public.client_kind as enum ('individual', 'company');
create type public.project_status as enum ('draft', 'planning', 'active', 'on_hold', 'completed', 'cancelled');
create type public.payment_plan_status as enum ('draft', 'active', 'archived');
create type public.recurring_frequency as enum ('monthly', 'quarterly', 'yearly');
create type public.recurring_service_status as enum ('draft', 'active', 'paused', 'cancelled');

create sequence public.client_number_seq;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  client_number text not null unique default ('KC-' || lpad(nextval('public.client_number_seq')::text, 6, '0')),
  kind public.client_kind not null default 'individual',
  origin_lead_id uuid unique references public.leads(id) on delete restrict,
  name text not null,
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  country text not null default 'HN',
  region text not null default '',
  city text not null default '',
  address text not null default '',
  status public.client_status not null default 'active',
  client_since date not null default current_date,
  notes text not null default '',
  tags text[] not null default '{}'::text[],
  assigned_to uuid references public.profiles(id) on delete restrict,
  assigned_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_valid check (length(btrim(name)) between 2 and 160),
  constraint clients_company_valid check (length(company) <= 200),
  constraint clients_email_valid check (email = '' or (email = lower(btrim(email)) and position('@' in email) > 1)),
  constraint clients_phone_valid check (length(phone) <= 60),
  constraint clients_whatsapp_valid check (length(whatsapp) <= 60),
  constraint clients_country_valid check (country ~ '^[A-Z]{2}$'),
  constraint clients_location_valid check (length(region) <= 120 and length(city) <= 120 and length(address) <= 500),
  constraint clients_since_valid check (client_since <= current_date),
  constraint clients_assignment_consistent check (assigned_to is not null or assigned_at is null)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  description text not null default '',
  status public.project_status not null default 'planning',
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  sold_at date,
  effective_date date not null default current_date,
  start_date date,
  target_end_date date,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete restrict,
  assigned_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_valid check (length(btrim(name)) between 2 and 180),
  constraint projects_effective_date_valid check (effective_date <= current_date),
  constraint projects_dates_valid check (target_end_date is null or start_date is null or target_end_date >= start_date),
  constraint projects_completion_valid check ((status = 'completed' and completed_at is not null) or status <> 'completed'),
  constraint projects_assignment_consistent check (assigned_to is not null or assigned_at is null)
);

create table public.project_payment_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  version integer not null check (version > 0),
  name text not null default 'Plan comercial',
  status public.payment_plan_status not null default 'draft',
  planned_total_minor bigint not null default 0 check (planned_total_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  activated_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version),
  constraint payment_plans_name_valid check (length(btrim(name)) between 2 and 140),
  constraint payment_plans_activation_consistent check (
    (status = 'active' and activated_by is not null and activated_at is not null)
    or status <> 'active'
  )
);

create unique index project_payment_plans_one_active_idx
  on public.project_payment_plans(project_id)
  where status = 'active';

create table public.project_installments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.project_payment_plans(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  label text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  due_date date,
  due_time time without time zone,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payment_plan_id, sequence),
  constraint project_installments_label_valid check (length(btrim(label)) between 1 and 140)
);

create table public.project_recurring_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete restrict,
  name text not null default 'Servicio recurrente',
  monthly_amount_minor bigint not null check (monthly_amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  frequency public.recurring_frequency not null default 'monthly',
  start_date date not null,
  billing_day smallint not null check (billing_day between 1 and 28),
  billing_time time without time zone not null default '09:00',
  timezone text not null default 'America/Tegucigalpa',
  status public.recurring_service_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_services_name_valid check (length(btrim(name)) between 2 and 140)
);

create table public.seller_assignment_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('client', 'project')),
  client_id uuid references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  previous_seller_id uuid references public.profiles(id) on delete set null,
  new_seller_id uuid references public.profiles(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_email text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint seller_assignment_entity_valid check (
    (entity_type = 'client' and client_id is not null and project_id is null)
    or (entity_type = 'project' and project_id is not null and client_id is null)
  )
);

alter table public.tasks
  add column client_id uuid references public.clients(id) on delete restrict,
  add column project_id uuid references public.projects(id) on delete restrict;

alter table public.activity_logs
  add column client_id uuid references public.clients(id) on delete restrict,
  add column project_id uuid references public.projects(id) on delete restrict;

alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in ('lead', 'note', 'task', 'notification', 'user', 'system', 'client', 'project', 'payment_plan', 'recurring_service'));

create index clients_assigned_created_idx on public.clients(assigned_to, created_at desc);
create index clients_status_since_idx on public.clients(status, client_since desc);
create index clients_search_idx on public.clients using gin(to_tsvector('simple', name || ' ' || company || ' ' || email || ' ' || phone));
create index projects_client_created_idx on public.projects(client_id, created_at desc);
create index projects_assigned_status_idx on public.projects(assigned_to, status);
create index payment_plans_project_created_idx on public.project_payment_plans(project_id, created_at desc);
create index installments_plan_sequence_idx on public.project_installments(payment_plan_id, sequence);
create index seller_events_client_idx on public.seller_assignment_events(client_id, created_at desc) where client_id is not null;
create index seller_events_project_idx on public.seller_assignment_events(project_id, created_at desc) where project_id is not null;
create index tasks_client_idx on public.tasks(client_id) where client_id is not null;
create index tasks_project_idx on public.tasks(project_id) where project_id is not null;
create index activity_logs_client_created_idx on public.activity_logs(client_id, created_at desc) where client_id is not null;
create index activity_logs_project_created_idx on public.activity_logs(project_id, created_at desc) where project_id is not null;

create trigger clients_set_updated_at before update on public.clients for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function private.set_updated_at();
create trigger project_payment_plans_set_updated_at before update on public.project_payment_plans for each row execute function private.set_updated_at();
create trigger project_installments_set_updated_at before update on public.project_installments for each row execute function private.set_updated_at();
create trigger project_recurring_services_set_updated_at before update on public.project_recurring_services for each row execute function private.set_updated_at();

create or replace function private.client_in_current_scope(p_client_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select private.has_global_lead_scope() or exists(
    select 1 from public.clients c where c.id = p_client_id and c.assigned_to = auth.uid()
  )
$$;

create or replace function private.project_in_current_scope(p_project_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select private.has_global_lead_scope() or exists(
    select 1
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = p_project_id and (p.assigned_to = auth.uid() or c.assigned_to = auth.uid())
  )
$$;

create or replace function private.guard_client_assignment()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is not null
    and (old.assigned_to, old.assigned_at, old.assigned_by) is distinct from (new.assigned_to, new.assigned_at, new.assigned_by)
    and not private.is_operations_admin()
  then raise exception 'client assignment requires owner or admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_project_assignment()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is not null
    and (old.assigned_to, old.assigned_at, old.assigned_by) is distinct from (new.assigned_to, new.assigned_at, new.assigned_by)
    and not private.is_operations_admin()
  then raise exception 'project assignment requires owner or admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clients_guard_assignment before update on public.clients for each row execute function private.guard_client_assignment();
create trigger projects_guard_assignment before update on public.projects for each row execute function private.guard_project_assignment();

alter table public.clients enable row level security;
alter table public.clients force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.project_payment_plans enable row level security;
alter table public.project_payment_plans force row level security;
alter table public.project_installments enable row level security;
alter table public.project_installments force row level security;
alter table public.project_recurring_services enable row level security;
alter table public.project_recurring_services force row level security;
alter table public.seller_assignment_events enable row level security;
alter table public.seller_assignment_events force row level security;

grant select, insert, update on public.clients, public.projects, public.project_payment_plans, public.project_installments, public.project_recurring_services to authenticated;
grant usage, select on sequence public.client_number_seq to authenticated;
grant select, insert on public.seller_assignment_events to authenticated;
grant delete on public.project_installments to authenticated;

create policy clients_read_scoped on public.clients for select to authenticated
  using (private.has_global_lead_scope() or assigned_to = auth.uid());
create policy clients_insert_scoped on public.clients for insert to authenticated
  with check (
    private.current_profile_role() in ('owner', 'admin', 'manager')
    or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  );
create policy clients_update_scoped on public.clients for update to authenticated
  using (private.current_profile_role() in ('owner', 'admin', 'manager') or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid()))
  with check (private.current_profile_role() in ('owner', 'admin', 'manager') or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid()));

create policy projects_read_scoped on public.projects for select to authenticated
  using (private.has_global_lead_scope() or assigned_to = auth.uid() or private.client_in_current_scope(client_id));
create policy projects_insert_scoped on public.projects for insert to authenticated
  with check (
    private.client_in_current_scope(client_id)
    and (private.current_profile_role() in ('owner', 'admin', 'manager') or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid()))
  );
create policy projects_update_scoped on public.projects for update to authenticated
  using (private.current_profile_role() in ('owner', 'admin', 'manager') or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid()))
  with check (private.current_profile_role() in ('owner', 'admin', 'manager') or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid()));

create policy payment_plans_read_scoped on public.project_payment_plans for select to authenticated
  using (private.project_in_current_scope(project_id));
create policy payment_plans_write_admin on public.project_payment_plans for all to authenticated
  using (private.current_profile_role() in ('owner', 'admin') and private.project_in_current_scope(project_id))
  with check (private.current_profile_role() in ('owner', 'admin') and private.project_in_current_scope(project_id));

create policy installments_read_scoped on public.project_installments for select to authenticated
  using (exists(select 1 from public.project_payment_plans pp where pp.id = payment_plan_id and private.project_in_current_scope(pp.project_id)));
create policy installments_write_manager on public.project_installments for all to authenticated
  using (private.current_profile_role() in ('owner', 'admin') and exists(select 1 from public.project_payment_plans pp where pp.id = payment_plan_id and private.project_in_current_scope(pp.project_id)))
  with check (private.current_profile_role() in ('owner', 'admin') and exists(select 1 from public.project_payment_plans pp where pp.id = payment_plan_id and private.project_in_current_scope(pp.project_id)));

create policy recurring_services_read_scoped on public.project_recurring_services for select to authenticated
  using (private.project_in_current_scope(project_id));
create policy recurring_services_write_admin on public.project_recurring_services for all to authenticated
  using (private.current_profile_role() in ('owner', 'admin') and private.project_in_current_scope(project_id))
  with check (private.current_profile_role() in ('owner', 'admin') and private.project_in_current_scope(project_id));

create policy seller_events_read_scoped on public.seller_assignment_events for select to authenticated
  using ((client_id is not null and private.client_in_current_scope(client_id)) or (project_id is not null and private.project_in_current_scope(project_id)));
create policy seller_events_insert_admin on public.seller_assignment_events for insert to authenticated
  with check (private.is_operations_admin() and actor_id = auth.uid());

drop policy if exists activity_logs_read_scoped on public.activity_logs;
create policy activity_logs_read_scoped on public.activity_logs for select to authenticated using (
  private.has_global_lead_scope()
  or actor_id = auth.uid()
  or recipient_id = auth.uid()
  or (lead_id is not null and private.lead_belongs_to_current_user(lead_id))
  or (client_id is not null and private.client_in_current_scope(client_id))
  or (project_id is not null and private.project_in_current_scope(project_id))
);

drop policy if exists activity_logs_insert_scoped on public.activity_logs;
create policy activity_logs_insert_scoped on public.activity_logs for insert to authenticated with check (
  private.is_operations_admin()
  or (private.current_profile_role() = 'manager' and actor_id = auth.uid())
  or (
    private.current_profile_role() = 'sales_agent'
    and actor_id = auth.uid()
    and (
      recipient_id = auth.uid()
      or (lead_id is not null and private.lead_belongs_to_current_user(lead_id))
      or (client_id is not null and private.client_in_current_scope(client_id))
      or (project_id is not null and private.project_in_current_scope(project_id))
    )
  )
);

create or replace function public.commercial_write(p_operation text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_lead public.leads%rowtype;
  v_client public.clients%rowtype;
  v_project public.projects%rowtype;
  v_plan public.project_payment_plans%rowtype;
  v_assignee public.profiles%rowtype;
  v_id uuid;
  v_event_id uuid;
  v_assignee_id uuid;
  v_client_id uuid;
  v_project_id uuid;
  v_plan_id uuid;
  v_version integer;
  v_sum bigint;
  v_count integer;
  v_item jsonb;
  v_updates jsonb;
  v_new_plan boolean := false;
  v_currency_count integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid commercial payload' using errcode = '22023';
  end if;
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'active profile required' using errcode = '42501'; end if;

  if p_operation = 'lead_convert' then
    if v_actor.role not in ('owner', 'admin', 'manager', 'sales_agent') then raise exception 'lead conversion forbidden' using errcode = '42501'; end if;
    select * into v_lead from public.leads where id = (p_payload->>'leadId')::uuid for update;
    if not found then raise exception 'lead not found' using errcode = 'P0002'; end if;
    if v_lead.status <> 'won' then raise exception 'only won leads can become clients' using errcode = '22023'; end if;
    if v_actor.role = 'sales_agent' and v_lead.assigned_to is distinct from v_actor.id then raise exception 'lead conversion forbidden' using errcode = '42501'; end if;
    select * into v_client from public.clients where origin_lead_id = v_lead.id;
    if found then return jsonb_build_object('id', v_client.id, 'created', false); end if;
    v_id := gen_random_uuid();
    insert into public.clients(id, origin_lead_id, kind, name, company, email, phone, whatsapp, status, client_since, notes, tags, assigned_to, assigned_at, assigned_by, created_by, metadata)
    values(
      v_id, v_lead.id, case when length(btrim(v_lead.business)) > 0 then 'company'::public.client_kind else 'individual'::public.client_kind end, v_lead.name, v_lead.business, lower(btrim(v_lead.email)), v_lead.phone, v_lead.phone, 'active',
      coalesce(nullif(p_payload->>'clientSince', '')::date, current_date), coalesce(p_payload->>'notes', ''), v_lead.tags,
      v_lead.assigned_to, case when v_lead.assigned_to is null then null else now() end, v_actor.id, v_actor.id,
      jsonb_build_object('convertedFromLead', v_lead.id)
    );
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id, firebase_id, entity_type, entity_id, lead_id, client_id, actor_id, actor_email, recipient_id, action, title, description, after_data, created_at)
    values(v_event_id, 'supabase:'||v_event_id::text, 'client', v_id::text, v_lead.id, v_id, v_actor.id, v_actor.email, coalesce(v_lead.assigned_to, v_actor.id), 'lead_converted_to_client', 'Lead convertido en cliente', 'Un usuario convirtió el lead ganado en cliente.', jsonb_build_object('originLeadId', v_lead.id), now());
    return jsonb_build_object('id', v_id, 'created', true);

  elsif p_operation = 'client_create' then
    if v_actor.role not in ('owner', 'admin', 'manager', 'sales_agent') then raise exception 'client creation forbidden' using errcode = '42501'; end if;
    v_assignee_id := nullif(p_payload->>'assignedToUid', '')::uuid;
    if v_actor.role = 'sales_agent' then v_assignee_id := v_actor.id; end if;
    if v_assignee_id is not null then
      select * into v_assignee from public.profiles where id = v_assignee_id and active and role = 'sales_agent';
      if not found then raise exception 'assignee is not an active sales agent' using errcode = '22023'; end if;
    end if;
    v_id := gen_random_uuid();
    insert into public.clients(id, kind, name, company, email, phone, whatsapp, country, region, city, address, status, client_since, notes, tags, assigned_to, assigned_at, assigned_by, created_by)
    values(v_id,coalesce(nullif(p_payload->>'kind','')::public.client_kind,case when length(btrim(coalesce(p_payload->>'company','')))>0 then 'company'::public.client_kind else 'individual'::public.client_kind end), btrim(p_payload->>'name'), coalesce(p_payload->>'company',''), lower(btrim(coalesce(p_payload->>'email',''))), coalesce(p_payload->>'phone',''),coalesce(p_payload->>'whatsapp',p_payload->>'phone',''),upper(coalesce(nullif(p_payload->>'country',''),'HN')),coalesce(p_payload->>'region',''),coalesce(p_payload->>'city',''),coalesce(p_payload->>'address',''),
      coalesce(nullif(p_payload->>'status','')::public.client_status,'active'), coalesce(nullif(p_payload->>'clientSince','')::date,current_date), coalesce(p_payload->>'notes',''),
      coalesce((select array_agg(value) from jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))), '{}'::text[]),
      v_assignee_id, case when v_assignee_id is null then null else now() end, v_actor.id, v_actor.id);
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'client',v_id::text,v_id,v_actor.id,v_actor.email,coalesce(v_assignee_id,v_actor.id),'client_created','Cliente creado','Un usuario creó el cliente manualmente.',jsonb_build_object('clientSince',coalesce(nullif(p_payload->>'clientSince','')::date,current_date)),now());
    return jsonb_build_object('id',v_id,'created',true);

  elsif p_operation = 'client_update' then
    if v_actor.role not in ('owner','admin','manager','sales_agent') then raise exception 'client update forbidden' using errcode='42501'; end if;
    v_updates := coalesce(p_payload->'updates','{}'::jsonb);
    if jsonb_typeof(v_updates)<>'object' or v_updates-array['kind','name','company','email','phone','whatsapp','country','region','city','address','status','clientSince','notes','tags']<>'{}'::jsonb then raise exception 'unsupported client update' using errcode='22023'; end if;
    select * into v_client from public.clients where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'client not found' using errcode='P0002'; end if;
    if v_actor.role='sales_agent' and v_client.assigned_to is distinct from v_actor.id then raise exception 'client update forbidden' using errcode='42501'; end if;
    update public.clients set
      name=case when v_updates?'name' then btrim(v_updates->>'name') else name end,
      kind=case when v_updates?'kind' then (v_updates->>'kind')::public.client_kind else kind end,
      company=case when v_updates?'company' then coalesce(v_updates->>'company','') else company end,
      email=case when v_updates?'email' then lower(btrim(coalesce(v_updates->>'email',''))) else email end,
      phone=case when v_updates?'phone' then coalesce(v_updates->>'phone','') else phone end,
      whatsapp=case when v_updates?'whatsapp' then coalesce(v_updates->>'whatsapp','') else whatsapp end,
      country=case when v_updates?'country' then upper(v_updates->>'country') else country end,
      region=case when v_updates?'region' then coalesce(v_updates->>'region','') else region end,
      city=case when v_updates?'city' then coalesce(v_updates->>'city','') else city end,
      address=case when v_updates?'address' then coalesce(v_updates->>'address','') else address end,
      status=case when v_updates?'status' then (v_updates->>'status')::public.client_status else status end,
      client_since=case when v_updates?'clientSince' then (v_updates->>'clientSince')::date else client_since end,
      notes=case when v_updates?'notes' then coalesce(v_updates->>'notes','') else notes end,
      tags=case when v_updates?'tags' then coalesce((select array_agg(value) from jsonb_array_elements_text(v_updates->'tags')),'{}'::text[]) else tags end
    where id=v_client.id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'client',v_client.id::text,v_client.id,v_actor.id,v_actor.email,coalesce(v_client.assigned_to,v_actor.id),'client_updated','Cliente actualizado','Un usuario actualizó la información del cliente.',to_jsonb(v_client),v_updates,now());
    return jsonb_build_object('id',v_client.id);

  elsif p_operation = 'client_assign' then
    if v_actor.role not in ('owner','admin') then raise exception 'client assignment forbidden' using errcode='42501'; end if;
    select * into v_client from public.clients where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'client not found' using errcode='P0002'; end if;
    v_assignee_id:=nullif(p_payload->>'assignedToUid','')::uuid;
    if v_assignee_id is not null then
      select * into v_assignee from public.profiles where id=v_assignee_id and active and role='sales_agent';
      if not found then raise exception 'assignee is not an active sales agent' using errcode='22023'; end if;
    end if;
    if v_client.assigned_to is not distinct from v_assignee_id then return jsonb_build_object('id',v_client.id,'changed',false); end if;
    update public.clients set assigned_to=v_assignee_id,assigned_at=case when v_assignee_id is null then null else now() end,assigned_by=v_actor.id where id=v_client.id;
    insert into public.seller_assignment_events(entity_type,client_id,previous_seller_id,new_seller_id,actor_id,actor_email,reason)
    values('client',v_client.id,v_client.assigned_to,v_assignee_id,v_actor.id,v_actor.email,coalesce(p_payload->>'reason',''));
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'client',v_client.id::text,v_client.id,v_actor.id,v_actor.email,coalesce(v_assignee_id,v_actor.id),case when v_client.assigned_to is null then 'client_assigned' else 'client_reassigned' end,'Responsable de cliente actualizado','Un Owner o Admin actualizó el responsable.',jsonb_build_object('assignedToUid',v_client.assigned_to),jsonb_build_object('assignedToUid',v_assignee_id),now());
    return jsonb_build_object('id',v_client.id,'changed',true);

  elsif p_operation = 'project_create' then
    if v_actor.role not in ('owner','admin','manager','sales_agent') then raise exception 'project creation forbidden' using errcode='42501'; end if;
    v_client_id:=(p_payload->>'clientId')::uuid;
    select * into v_client from public.clients where id=v_client_id;
    if not found then raise exception 'client not found' using errcode='P0002'; end if;
    if v_actor.role='sales_agent' and v_client.assigned_to is distinct from v_actor.id then raise exception 'project creation forbidden' using errcode='42501'; end if;
    v_assignee_id:=coalesce(nullif(p_payload->>'assignedToUid','')::uuid,v_client.assigned_to);
    if v_actor.role='sales_agent' then v_assignee_id:=v_actor.id; end if;
    if v_assignee_id is not null then
      select * into v_assignee from public.profiles where id=v_assignee_id and active and role='sales_agent';
      if not found then raise exception 'assignee is not an active sales agent' using errcode='22023'; end if;
    end if;
    v_id:=gen_random_uuid();
    insert into public.projects(id,client_id,name,description,status,total_amount_minor,currency,sold_at,effective_date,start_date,target_end_date,completed_at,assigned_to,assigned_at,assigned_by,created_by)
    values(v_id,v_client.id,btrim(p_payload->>'name'),coalesce(p_payload->>'description',''),coalesce(nullif(p_payload->>'status','')::public.project_status,'planning'),
      coalesce((p_payload->>'totalAmountMinor')::bigint,0),upper(coalesce(nullif(p_payload->>'currency',''),'USD')),nullif(p_payload->>'soldAt','')::date,coalesce(nullif(p_payload->>'effectiveDate','')::date,current_date),nullif(p_payload->>'startDate','')::date,nullif(p_payload->>'targetEndDate','')::date,
      case when p_payload->>'status'='completed' then now() else null end,v_assignee_id,case when v_assignee_id is null then null else now() end,v_actor.id,v_actor.id);
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'project',v_id::text,v_client.id,v_id,v_actor.id,v_actor.email,coalesce(v_assignee_id,v_actor.id),'project_created','Proyecto creado','Un usuario creó un proyecto para el cliente.',jsonb_build_object('totalAmountMinor',coalesce((p_payload->>'totalAmountMinor')::bigint,0),'currency',upper(coalesce(nullif(p_payload->>'currency',''),'USD'))),now());
    return jsonb_build_object('id',v_id);

  elsif p_operation = 'project_update' then
    if v_actor.role not in ('owner','admin','manager','sales_agent') then raise exception 'project update forbidden' using errcode='42501'; end if;
    v_updates:=coalesce(p_payload->'updates','{}'::jsonb);
    if jsonb_typeof(v_updates)<>'object' or v_updates-array['name','description','status','totalAmountMinor','currency','soldAt','effectiveDate','startDate','targetEndDate']<>'{}'::jsonb then raise exception 'unsupported project update' using errcode='22023'; end if;
    select * into v_project from public.projects where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'project not found' using errcode='P0002'; end if;
    if v_actor.role='sales_agent' and v_project.assigned_to is distinct from v_actor.id then raise exception 'project update forbidden' using errcode='42501'; end if;
    if exists(select 1 from public.project_payment_plans where project_id=v_project.id and status='active') and v_updates ?| array['totalAmountMinor','currency'] then
      raise exception 'archive the active payment plan before changing project money' using errcode='55000';
    end if;
    update public.projects set
      name=case when v_updates?'name' then btrim(v_updates->>'name') else name end,
      description=case when v_updates?'description' then coalesce(v_updates->>'description','') else description end,
      status=case when v_updates?'status' then (v_updates->>'status')::public.project_status else status end,
      total_amount_minor=case when v_updates?'totalAmountMinor' then (v_updates->>'totalAmountMinor')::bigint else total_amount_minor end,
      currency=case when v_updates?'currency' then upper(v_updates->>'currency') else currency end,
      sold_at=case when v_updates?'soldAt' then nullif(v_updates->>'soldAt','')::date else sold_at end,
      effective_date=case when v_updates?'effectiveDate' then (v_updates->>'effectiveDate')::date else effective_date end,
      start_date=case when v_updates?'startDate' then nullif(v_updates->>'startDate','')::date else start_date end,
      target_end_date=case when v_updates?'targetEndDate' then nullif(v_updates->>'targetEndDate','')::date else target_end_date end,
      completed_at=case when v_updates->>'status'='completed' then coalesce(completed_at,now()) when v_updates?'status' then null else completed_at end
    where id=v_project.id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'project',v_project.id::text,v_project.client_id,v_project.id,v_actor.id,v_actor.email,coalesce(v_project.assigned_to,v_actor.id),case when v_updates?'status' then 'project_status_changed' else 'project_updated' end,'Proyecto actualizado','Un usuario actualizó el proyecto.',to_jsonb(v_project),v_updates,now());
    return jsonb_build_object('id',v_project.id);

  elsif p_operation = 'project_assign' then
    if v_actor.role not in ('owner','admin') then raise exception 'project assignment forbidden' using errcode='42501'; end if;
    select * into v_project from public.projects where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'project not found' using errcode='P0002'; end if;
    v_assignee_id:=nullif(p_payload->>'assignedToUid','')::uuid;
    if v_assignee_id is not null then
      select * into v_assignee from public.profiles where id=v_assignee_id and active and role='sales_agent';
      if not found then raise exception 'assignee is not an active sales agent' using errcode='22023'; end if;
    end if;
    if v_project.assigned_to is not distinct from v_assignee_id then return jsonb_build_object('id',v_project.id,'changed',false); end if;
    update public.projects set assigned_to=v_assignee_id,assigned_at=case when v_assignee_id is null then null else now() end,assigned_by=v_actor.id where id=v_project.id;
    insert into public.seller_assignment_events(entity_type,project_id,previous_seller_id,new_seller_id,actor_id,actor_email,reason)
    values('project',v_project.id,v_project.assigned_to,v_assignee_id,v_actor.id,v_actor.email,coalesce(p_payload->>'reason',''));
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'project',v_project.id::text,v_project.client_id,v_project.id,v_actor.id,v_actor.email,coalesce(v_assignee_id,v_actor.id),case when v_project.assigned_to is null then 'project_assigned' else 'project_reassigned' end,'Responsable de proyecto actualizado','Un Owner o Admin actualizó el responsable.',jsonb_build_object('assignedToUid',v_project.assigned_to),jsonb_build_object('assignedToUid',v_assignee_id),now());
    return jsonb_build_object('id',v_project.id,'changed',true);

  elsif p_operation = 'payment_plan_save' then
    if v_actor.role not in ('owner','admin') then raise exception 'payment plan edit forbidden' using errcode='42501'; end if;
    v_project_id:=(p_payload->>'projectId')::uuid;
    select * into v_project from public.projects where id=v_project_id for update;
    if not found then raise exception 'project not found' using errcode='P0002'; end if;
    if jsonb_typeof(coalesce(p_payload->'installments','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'installments','[]'::jsonb))>60 then raise exception 'invalid installments' using errcode='22023'; end if;
    v_plan_id:=nullif(p_payload->>'id','')::uuid;
    if v_plan_id is null then
      v_new_plan:=true;
      select coalesce(max(version),0)+1 into v_version from public.project_payment_plans where project_id=v_project.id;
      v_plan_id:=gen_random_uuid();
      insert into public.project_payment_plans(id,project_id,version,name,status,planned_total_minor,currency,created_by)
      values(v_plan_id,v_project.id,v_version,coalesce(nullif(btrim(p_payload->>'name'),''),'Plan comercial'),'draft',0,v_project.currency,v_actor.id);
    else
      select * into v_plan from public.project_payment_plans where id=v_plan_id and project_id=v_project.id for update;
      if not found then raise exception 'payment plan not found' using errcode='P0002'; end if;
      if v_plan.status<>'draft' then raise exception 'only draft plans can be edited' using errcode='55000'; end if;
      update public.project_payment_plans set name=coalesce(nullif(btrim(p_payload->>'name'),''),name) where id=v_plan_id;
      delete from public.project_installments where payment_plan_id=v_plan_id;
    end if;
    v_sum:=0; v_count:=0;
    for v_item in select value from jsonb_array_elements(coalesce(p_payload->'installments','[]'::jsonb)) loop
      v_count:=v_count+1;
      if (v_item->>'amountMinor')::bigint < 0 then raise exception 'installment amount cannot be negative' using errcode='22023'; end if;
      insert into public.project_installments(payment_plan_id,sequence,label,amount_minor,currency,due_date,due_time,notes)
      values(v_plan_id,v_count,coalesce(nullif(btrim(v_item->>'label'),''),'Cuota '||v_count::text),(v_item->>'amountMinor')::bigint,upper(coalesce(nullif(v_item->>'currency',''),v_project.currency)),nullif(v_item->>'dueDate','')::date,nullif(v_item->>'dueTime','')::time,coalesce(v_item->>'notes',''));
      v_sum:=v_sum+(v_item->>'amountMinor')::bigint;
      v_event_id:=gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'payment_plan',v_plan_id::text,v_project.client_id,v_project.id,v_actor.id,v_actor.email,coalesce(v_project.assigned_to,v_actor.id),'installment_created','Cuota comercial guardada','Un usuario guardó una cuota planificada.',jsonb_build_object('sequence',v_count,'amountMinor',(v_item->>'amountMinor')::bigint,'currency',upper(coalesce(nullif(v_item->>'currency',''),v_project.currency))),now());
    end loop;
    update public.project_payment_plans set planned_total_minor=v_sum,currency=v_project.currency where id=v_plan_id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'payment_plan',v_plan_id::text,v_project.client_id,v_project.id,v_actor.id,v_actor.email,coalesce(v_project.assigned_to,v_actor.id),case when v_new_plan then 'payment_plan_created' else 'payment_plan_updated' end,'Plan comercial guardado','Un usuario guardó un borrador de distribución comercial.',jsonb_build_object('planId',v_plan_id,'installmentCount',v_count,'plannedTotalMinor',v_sum),now());
    return jsonb_build_object('id',v_plan_id,'installmentCount',v_count,'plannedTotalMinor',v_sum,'status','draft');

  elsif p_operation = 'payment_plan_activate' then
    if v_actor.role not in ('owner','admin') then raise exception 'payment plan activation forbidden' using errcode='42501'; end if;
    v_plan_id:=(p_payload->>'id')::uuid;
    select pp.* into v_plan from public.project_payment_plans pp where pp.id=v_plan_id for update;
    if not found then raise exception 'payment plan not found' using errcode='P0002'; end if;
    select * into v_project from public.projects where id=v_plan.project_id for update;
    select coalesce(sum(amount_minor),0),count(*),count(distinct currency) into v_sum,v_count,v_currency_count from public.project_installments where payment_plan_id=v_plan.id;
    if v_project.total_amount_minor<=0 or v_count=0 or v_sum<>v_project.total_amount_minor or v_plan.currency<>v_project.currency or v_currency_count<>1 or exists(select 1 from public.project_installments where payment_plan_id=v_plan.id and currency<>v_project.currency) then
      raise exception 'installment total must equal project total and currency' using errcode='23514';
    end if;
    update public.project_payment_plans set status='archived',archived_at=now() where project_id=v_project.id and status='active' and id<>v_plan.id;
    update public.project_payment_plans set status='active',planned_total_minor=v_sum,activated_by=v_actor.id,activated_at=now(),archived_at=null where id=v_plan.id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'payment_plan',v_plan.id::text,v_project.client_id,v_project.id,v_actor.id,v_actor.email,coalesce(v_project.assigned_to,v_actor.id),'payment_plan_activated','Plan comercial activado','Un usuario activó el plan después de validar el total.',jsonb_build_object('planId',v_plan.id,'plannedTotalMinor',v_sum,'currency',v_plan.currency),now());
    return jsonb_build_object('id',v_plan.id,'status','active','plannedTotalMinor',v_sum);

  elsif p_operation = 'recurring_service_save' then
    if v_actor.role not in ('owner','admin') then raise exception 'recurring service edit forbidden' using errcode='42501'; end if;
    v_project_id:=(p_payload->>'projectId')::uuid;
    select * into v_project from public.projects where id=v_project_id for update;
    if not found then raise exception 'project not found' using errcode='P0002'; end if;
    insert into public.project_recurring_services(project_id,name,monthly_amount_minor,currency,frequency,start_date,billing_day,billing_time,timezone,status,created_by,updated_by)
    values(v_project.id,coalesce(nullif(btrim(p_payload->>'name'),''),'Servicio recurrente'),(p_payload->>'monthlyAmountMinor')::bigint,upper(coalesce(nullif(p_payload->>'currency',''),v_project.currency)),
      coalesce(nullif(p_payload->>'frequency','')::public.recurring_frequency,'monthly'),(p_payload->>'startDate')::date,(p_payload->>'billingDay')::smallint,
      coalesce(nullif(p_payload->>'billingTime','')::time,'09:00'),coalesce(nullif(p_payload->>'timezone',''),'America/Tegucigalpa'),coalesce(nullif(p_payload->>'status','')::public.recurring_service_status,'draft'),v_actor.id,v_actor.id)
    on conflict(project_id) do update set name=excluded.name,monthly_amount_minor=excluded.monthly_amount_minor,currency=excluded.currency,frequency=excluded.frequency,start_date=excluded.start_date,
      billing_day=excluded.billing_day,billing_time=excluded.billing_time,timezone=excluded.timezone,status=excluded.status,updated_by=v_actor.id;
    select id into v_id from public.project_recurring_services where project_id=v_project.id;
    v_event_id:=gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'recurring_service',v_id::text,v_project.client_id,v_project.id,v_actor.id,v_actor.email,coalesce(v_project.assigned_to,v_actor.id),'recurring_service_configured','Servicio recurrente guardado','Un usuario guardó la configuración comercial recurrente sin generar cobros.',jsonb_build_object('serviceId',v_id,'status',coalesce(nullif(p_payload->>'status',''),'draft')),now());
    return jsonb_build_object('id',v_id);
  end if;

  raise exception 'unsupported commercial operation' using errcode='22023';
end;
$$;

revoke all on function public.commercial_write(text,jsonb) from public,anon;
grant execute on function public.commercial_write(text,jsonb) to authenticated;

comment on table public.clients is 'First-class CRM clients. client_since is the historical business-effective date; created_at is the system audit timestamp.';
comment on table public.project_payment_plans is 'Versioned commercial distribution plans only; no receivable or payment transaction is created in Phase 1.';
comment on table public.project_installments is 'Planned commercial installments in minor currency units; not real payment records.';
comment on table public.project_recurring_services is 'Commercial recurring-service configuration only; Phase 1 generates no invoice, receivable, email or cron event.';
comment on function public.commercial_write(text,jsonb) is 'Authenticated atomic commercial mutations with human actor audit events and role checks.';
