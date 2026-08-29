-- Phase 3: posted expenses, multi-currency cash reporting, and audited finance exports.
-- This migration creates configuration only; it does not insert business transactions.

create type public.expense_status as enum ('posted', 'reversed');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_name_valid check (length(btrim(name)) between 2 and 80),
  constraint expense_categories_description_valid check (length(description) <= 500),
  constraint expense_categories_sort_valid check (sort_order between 0 and 10000)
);

create unique index expense_categories_name_unique_idx on public.expense_categories(lower(btrim(name)));

insert into public.expense_categories(name, description, sort_order) values
  ('Software', 'Licencias y herramientas digitales.', 10),
  ('Hosting', 'Infraestructura, servidores y alojamiento.', 20),
  ('Dominios', 'Registro y renovacion de dominios.', 30),
  ('Marketing', 'Publicidad y promocion comercial.', 40),
  ('Contratistas', 'Servicios profesionales contratados.', 50),
  ('Operaciones', 'Costos operativos generales.', 60),
  ('Oficina', 'Suministros y servicios de oficina.', 70),
  ('Impuestos y comisiones', 'Impuestos, tasas y comisiones financieras.', 80),
  ('Otros', 'Gastos que no corresponden a otra categoria.', 90);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  description text not null,
  vendor text not null default '',
  amount_minor bigint not null,
  currency text not null,
  expense_date date not null,
  paid_at timestamptz,
  payment_method public.payment_method not null,
  reference text not null default '',
  notes text not null default '',
  project_id uuid references public.projects(id) on delete restrict,
  status public.expense_status not null default 'posted',
  created_by uuid not null references public.profiles(id) on delete restrict,
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  reversal_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_description_valid check (length(btrim(description)) between 2 and 240),
  constraint expenses_vendor_valid check (length(vendor) <= 200),
  constraint expenses_amount_positive check (amount_minor > 0),
  constraint expenses_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint expenses_reference_valid check (length(reference) <= 240),
  constraint expenses_notes_valid check (length(notes) <= 4000),
  constraint expenses_reversal_consistent check (
    (status = 'posted' and reversed_at is null and reversed_by is null and reversal_reason = '')
    or
    (status = 'reversed' and reversed_at is not null and reversed_by is not null and length(btrim(reversal_reason)) >= 3)
  )
);

create index expenses_date_currency_idx on public.expenses(expense_date desc, currency);
create index expenses_category_date_idx on public.expenses(category_id, expense_date desc);
create index expenses_project_date_idx on public.expenses(project_id, expense_date desc) where project_id is not null;
create index expenses_status_creator_idx on public.expenses(status, created_by, created_at desc);

create trigger expense_categories_set_updated_at before update on public.expense_categories
for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function private.set_updated_at();

create or replace function private.block_expense_delete()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'posted financial history cannot be deleted' using errcode = '55000';
end;
$$;
create trigger expenses_no_delete before delete on public.expenses
for each row execute function private.block_expense_delete();

alter table public.activity_logs add column expense_id uuid references public.expenses(id) on delete restrict;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in (
    'lead', 'note', 'task', 'notification', 'user', 'system', 'client', 'project',
    'payment_plan', 'recurring_service', 'receivable', 'payment', 'billing',
    'expense', 'expense_category', 'financial_report'
  ));
create index activity_logs_expense_created_idx on public.activity_logs(expense_id, created_at desc) where expense_id is not null;

alter table public.expense_categories enable row level security;
alter table public.expense_categories force row level security;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;

grant select on public.expense_categories, public.expenses to authenticated;
create policy expense_categories_read_finance on public.expense_categories for select to authenticated
  using (private.current_profile_role() in ('owner', 'admin'));
create policy expenses_read_finance on public.expenses for select to authenticated
  using (private.current_profile_role() in ('owner', 'admin'));

create or replace function public.finance_write(p_operation text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_category public.expense_categories%rowtype;
  v_expense public.expenses%rowtype;
  v_project public.projects%rowtype;
  v_event_id uuid;
  v_id uuid;
  v_amount bigint;
  v_currency text;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'finance operation requires owner or admin' using errcode = '42501';
  end if;

  if p_operation = 'category_create' then
    insert into public.expense_categories(name, description, sort_order, created_by)
    values (
      btrim(coalesce(p_payload->>'name', '')),
      btrim(coalesce(p_payload->>'description', '')),
      coalesce((p_payload->>'sortOrder')::integer, 100),
      v_actor.id
    ) returning * into v_category;
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'expense_category',v_category.id::text,v_actor.id,v_actor.email,v_actor.id,
      'expense_category_created','Categoria de gasto creada','Se creo una categoria de gastos.',
      jsonb_build_object('categoryId',v_category.id,'name',v_category.name),now());
    return jsonb_build_object('id',v_category.id,'changed',true);

  elsif p_operation = 'category_update' then
    v_id := (p_payload->>'id')::uuid;
    select * into v_category from public.expense_categories where id = v_id for update;
    if not found then raise exception 'expense category not found' using errcode = 'P0002'; end if;
    update public.expense_categories set
      name = btrim(coalesce(p_payload->>'name', name)),
      description = btrim(coalesce(p_payload->>'description', description)),
      active = coalesce((p_payload->>'active')::boolean, active),
      sort_order = coalesce((p_payload->>'sortOrder')::integer, sort_order)
    where id = v_id returning * into v_category;
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'expense_category',v_category.id::text,v_actor.id,v_actor.email,v_actor.id,
      'expense_category_updated','Categoria de gasto actualizada','Se actualizo una categoria de gastos.',
      jsonb_build_object('categoryId',v_category.id,'name',v_category.name,'active',v_category.active),now());
    return jsonb_build_object('id',v_category.id,'changed',true);

  elsif p_operation = 'expense_create' then
    v_amount := (p_payload->>'amountMinor')::bigint;
    v_currency := upper(btrim(coalesce(p_payload->>'currency','')));
    if v_amount <= 0 then raise exception 'expense amount must be positive' using errcode = '23514'; end if;
    if v_currency not in ('USD','HNL') then raise exception 'unsupported expense currency' using errcode = '23514'; end if;
    select * into v_category from public.expense_categories where id=(p_payload->>'categoryId')::uuid and active=true;
    if not found then raise exception 'active expense category not found' using errcode = 'P0002'; end if;
    if nullif(p_payload->>'projectId','') is not null then
      select * into v_project from public.projects where id=(p_payload->>'projectId')::uuid;
      if not found then raise exception 'project not found' using errcode = 'P0002'; end if;
    end if;
    insert into public.expenses(category_id,description,vendor,amount_minor,currency,expense_date,paid_at,payment_method,reference,notes,project_id,created_by)
    values(
      v_category.id,btrim(coalesce(p_payload->>'description','')),btrim(coalesce(p_payload->>'vendor','')),
      v_amount,v_currency,(p_payload->>'expenseDate')::date,
      nullif(p_payload->>'paidAt','')::timestamptz,(p_payload->>'paymentMethod')::public.payment_method,
      btrim(coalesce(p_payload->>'reference','')),btrim(coalesce(p_payload->>'notes','')),
      nullif(p_payload->>'projectId','')::uuid,v_actor.id
    ) returning * into v_expense;
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,expense_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'expense',v_expense.id::text,v_project.client_id,v_expense.project_id,v_expense.id,v_actor.id,v_actor.email,v_actor.id,
      'expense_recorded','Gasto registrado','Se registro un gasto real sin eliminar historial.',
      jsonb_build_object('amountMinor',v_expense.amount_minor,'currency',v_expense.currency,'categoryId',v_expense.category_id),now());
    return jsonb_build_object('id',v_expense.id,'status',v_expense.status,'changed',true);

  elsif p_operation = 'expense_reverse' then
    v_id := (p_payload->>'id')::uuid;
    select * into v_expense from public.expenses where id=v_id for update;
    if not found then raise exception 'expense not found' using errcode = 'P0002'; end if;
    if v_expense.status='reversed' then return jsonb_build_object('id',v_id,'status','reversed','changed',false); end if;
    if length(btrim(coalesce(p_payload->>'reason',''))) < 3 then raise exception 'reversal reason required' using errcode = '22023'; end if;
    update public.expenses set status='reversed',reversed_at=now(),reversed_by=v_actor.id,reversal_reason=btrim(p_payload->>'reason')
      where id=v_id returning * into v_expense;
    select * into v_project from public.projects where id=v_expense.project_id;
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,expense_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'expense',v_expense.id::text,v_project.client_id,v_expense.project_id,v_expense.id,v_actor.id,v_actor.email,v_actor.id,
      'expense_reversed','Gasto anulado','Se anulo el gasto conservando su historial.',
      jsonb_build_object('reason',v_expense.reversal_reason),now());
    return jsonb_build_object('id',v_id,'status','reversed','changed',true);

  elsif p_operation = 'report_exported' then
    if coalesce(p_payload->>'format','') not in ('csv','pdf','xlsx') then raise exception 'invalid export format' using errcode='22023'; end if;
    v_event_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(v_event_id,'supabase:'||v_event_id::text,'financial_report',v_event_id::text,v_actor.id,v_actor.email,v_actor.id,
      'financial_report_exported','Reporte financiero exportado','Se exporto un reporte financiero.',
      jsonb_build_object('report',left(coalesce(p_payload->>'report',''),80),'format',p_payload->>'format'),now());
    return jsonb_build_object('id',v_event_id,'changed',true);
  end if;
  raise exception 'unsupported finance operation' using errcode='22023';
end;
$$;

revoke all on function public.finance_write(text,jsonb) from public,anon;
grant execute on function public.finance_write(text,jsonb) to authenticated;

create or replace function public.finance_summary(p_from date, p_to date)
returns table(
  currency text,
  sold_minor bigint,
  collected_minor bigint,
  outstanding_minor bigint,
  overdue_minor bigint,
  recurring_collected_minor bigint,
  expense_minor bigint,
  net_cash_minor bigint
)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if private.current_profile_role() not in ('owner','admin') then raise exception 'finance report denied' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to-p_from > 3660 then raise exception 'invalid finance date range' using errcode='22023'; end if;
  return query
  with currencies as (
    select p.currency from public.projects p where coalesce(p.sold_at::date,p.effective_date) between p_from and p_to
    union select p.currency from public.payments p where p.paid_at::date between p_from and p_to
    union select r.currency from public.receivables r where r.due_date between p_from and p_to
    union select e.currency from public.expenses e where e.expense_date between p_from and p_to
  ), sold as (
    select p.currency,sum(p.total_amount_minor)::bigint amount from public.projects p
      where p.status<>'cancelled' and coalesce(p.sold_at::date,p.effective_date) between p_from and p_to group by p.currency
  ), collected as (
    select p.currency,sum(p.amount_minor)::bigint amount from public.payments p
      where p.status='posted' and p.paid_at::date between p_from and p_to group by p.currency
  ), outstanding as (
    select r.currency,sum(r.balance_minor)::bigint amount from public.receivables r
      where r.payment_state in ('open','partially_paid') and r.due_date between p_from and p_to group by r.currency
  ), overdue as (
    select r.currency,sum(r.balance_minor)::bigint amount from public.receivables r
      where r.payment_state in ('open','partially_paid') and r.due_date < current_date and r.due_date between p_from and p_to group by r.currency
  ), recurring as (
    select p.currency,sum(a.amount_minor)::bigint amount from public.payment_allocations a
      join public.payments p on p.id=a.payment_id and p.status='posted'
      join public.receivables r on r.id=a.receivable_id and r.origin_type='recurring_service'
      where a.reversed_at is null and p.paid_at::date between p_from and p_to group by p.currency
  ), spent as (
    select e.currency,sum(e.amount_minor)::bigint amount from public.expenses e
      where e.status='posted' and e.expense_date between p_from and p_to group by e.currency
  )
  select c.currency,coalesce(s.amount,0),coalesce(co.amount,0),coalesce(o.amount,0),coalesce(ov.amount,0),coalesce(re.amount,0),coalesce(sp.amount,0),coalesce(co.amount,0)-coalesce(sp.amount,0)
  from currencies c left join sold s using(currency) left join collected co using(currency) left join outstanding o using(currency)
  left join overdue ov using(currency) left join recurring re using(currency) left join spent sp using(currency)
  order by c.currency;
end;
$$;

create or replace function public.finance_monthly_series(p_from date,p_to date,p_currency text)
returns table(month_start date,collected_minor bigint,expense_minor bigint)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if private.current_profile_role() not in ('owner','admin') then raise exception 'finance report denied' using errcode='42501'; end if;
  if p_currency not in ('USD','HNL') or p_to<p_from or p_to-p_from>1096 then raise exception 'invalid finance series range' using errcode='22023'; end if;
  return query
  with months as (select generate_series(date_trunc('month',p_from::timestamp),date_trunc('month',p_to::timestamp),interval '1 month')::date month_start),
  collected as (select date_trunc('month',paid_at)::date m,sum(amount_minor)::bigint amount from public.payments where status='posted' and currency=p_currency and paid_at::date between p_from and p_to group by 1),
  spent as (select date_trunc('month',expense_date)::date m,sum(amount_minor)::bigint amount from public.expenses where status='posted' and currency=p_currency and expense_date between p_from and p_to group by 1)
  select m.month_start,coalesce(c.amount,0),coalesce(s.amount,0) from months m left join collected c on c.m=m.month_start left join spent s on s.m=m.month_start order by m.month_start;
end;
$$;

create or replace function public.finance_report(
  p_report text,p_from date,p_to date,p_currency text default null,p_client_id uuid default null,p_project_id uuid default null,
  p_seller_id uuid default null,p_payment_method text default null,p_category_id uuid default null,p_page integer default 1,p_page_size integer default 25
)
returns table(
  occurred_on date,record_type text,party text,concept text,project_name text,payment_method text,
  amount_minor bigint,currency text,status text,seller_id uuid,record_id uuid,total_count bigint
)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if private.current_profile_role() not in ('owner','admin') then raise exception 'finance report denied' using errcode='42501'; end if;
  if p_report not in ('collections','receivables','overdue','expenses','cash_result','project_sales','seller') then raise exception 'invalid report' using errcode='22023'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'invalid report range' using errcode='22023'; end if;
  if p_currency is not null and p_currency not in ('USD','HNL') then raise exception 'invalid report currency' using errcode='22023'; end if;
  if p_page<1 or p_page_size not between 1 and 200 then raise exception 'invalid pagination' using errcode='22023'; end if;
  return query
  with report_rows as (
    select p.paid_at::date occurred_on,'payment'::text record_type,coalesce(c.company,c.name) party,'Pago recibido'::text concept,
      ''::text project_name,p.method::text payment_method,p.amount_minor,p.currency,p.status::text status,c.assigned_to seller_id,p.id record_id,c.id client_id,null::uuid project_id,null::uuid category_id
    from public.payments p join public.clients c on c.id=p.client_id
    where p_report in ('collections','cash_result','seller') and p.status='posted'
    union all
    select r.due_date,'receivable',coalesce(c.company,c.name),r.description,pr.name,''::text,r.balance_minor,r.currency,r.payment_state::text,coalesce(pr.assigned_to,c.assigned_to),r.id,c.id,pr.id,null::uuid
    from public.receivables r join public.clients c on c.id=r.client_id join public.projects pr on pr.id=r.project_id
    where p_report in ('receivables','overdue') and r.payment_state in ('open','partially_paid') and (p_report<>'overdue' or r.due_date<current_date)
    union all
    select e.expense_date,'expense',coalesce(nullif(e.vendor,''),'Sin proveedor'),e.description,coalesce(pr.name,''),e.payment_method::text,
      case when p_report='cash_result' then -e.amount_minor else e.amount_minor end,e.currency,e.status::text,pr.assigned_to,e.id,pr.client_id,pr.id,e.category_id
    from public.expenses e left join public.projects pr on pr.id=e.project_id
    where p_report in ('expenses','cash_result') and (p_report='expenses' or e.status='posted')
    union all
    select coalesce(pr.sold_at::date,pr.effective_date),'project_sale',coalesce(c.company,c.name),pr.name,pr.name,''::text,pr.total_amount_minor,pr.currency,pr.status::text,coalesce(pr.assigned_to,c.assigned_to),pr.id,c.id,pr.id,null::uuid
    from public.projects pr join public.clients c on c.id=pr.client_id where p_report in ('project_sales','seller') and pr.status<>'cancelled'
  ), filtered as (
    select * from report_rows r where r.occurred_on between p_from and p_to
      and (p_currency is null or r.currency=p_currency)
      and (p_client_id is null or r.client_id=p_client_id)
      and (p_project_id is null or r.project_id=p_project_id)
      and (p_seller_id is null or r.seller_id=p_seller_id)
      and (p_payment_method is null or r.payment_method=p_payment_method)
      and (p_category_id is null or r.category_id=p_category_id)
  )
  select f.occurred_on,f.record_type,f.party,f.concept,f.project_name,f.payment_method,f.amount_minor,f.currency,f.status,f.seller_id,f.record_id,count(*) over()
  from filtered f order by f.occurred_on desc,f.record_id limit p_page_size offset (p_page-1)*p_page_size;
end;
$$;

revoke all on function public.finance_summary(date,date) from public,anon;
revoke all on function public.finance_monthly_series(date,date,text) from public,anon;
revoke all on function public.finance_report(text,date,date,text,uuid,uuid,uuid,text,uuid,integer,integer) from public,anon;
grant execute on function public.finance_summary(date,date) to authenticated;
grant execute on function public.finance_monthly_series(date,date,text) to authenticated;
grant execute on function public.finance_report(text,date,date,text,uuid,uuid,uuid,text,uuid,integer,integer) to authenticated;

comment on table public.expenses is 'Posted cash expenses in minor units. Reversal preserves immutable financial history.';
comment on function public.finance_summary(date,date) is 'Owner/Admin multi-currency summary; sold value, cash collected, obligations, expenses and net cash remain distinct.';
comment on function public.finance_report(text,date,date,text,uuid,uuid,uuid,text,uuid,integer,integer) is 'Server-filtered and paginated finance reporting layer. USD and HNL are never aggregated together.';
