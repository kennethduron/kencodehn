-- Phase 4: reuse recurring generation, reminders, allocations and finance reporting.
create or replace function private.add_on_recurring_period_date(p_service public.add_on_recurring_services,p_index integer)
returns date language sql immutable security definer set search_path=pg_catalog as $$
  select case when p_index=0 then p_service.start_date else (date_trunc('month',p_service.start_date)::date+make_interval(months=>p_index))::date+(p_service.billing_day-1) end
$$;

create or replace function private.generate_add_on_recurring_receivables(p_service_id uuid,p_horizon_date date)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_service public.add_on_recurring_services%rowtype; v_sale public.add_on_sales%rowtype; v_add_on public.project_add_ons%rowtype; v_index integer; v_due date; v_period text; v_inserted integer:=0; v_receivable_id uuid; v_event_id uuid;
begin
  select * into v_service from public.add_on_recurring_services where id=p_service_id for update;
  if not found or v_service.status<>'active' then return 0; end if;
  select * into v_sale from public.add_on_sales where id=v_service.add_on_sale_id;
  select * into v_add_on from public.project_add_ons where id=v_sale.add_on_id;
  for v_index in 0..120 loop
    v_due:=private.add_on_recurring_period_date(v_service,v_index);
    exit when v_due>p_horizon_date;
    continue when v_due<v_service.start_date;
    v_period:=to_char(v_due,'YYYY-MM');
    insert into public.receivables(client_id,project_id,origin_type,add_on_recurring_service_id,recurring_period_key,description,amount_due_minor,currency,due_date,due_time,due_timezone,notifications_enabled,created_by,metadata)
    values(v_sale.client_id,v_sale.project_id,'add_on_recurring',v_service.id,v_period,v_add_on.name||' - '||v_service.name,v_service.monthly_amount_minor,'USD',v_due,v_service.billing_time,v_service.timezone,true,v_service.updated_by,jsonb_build_object('addOnId',v_add_on.id,'saleId',v_sale.id,'component','add_on_recurring'))
    on conflict(add_on_recurring_service_id,recurring_period_key) where add_on_recurring_service_id is not null do nothing returning id into v_receivable_id;
    if found then
      v_inserted:=v_inserted+1; v_event_id:=gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,add_on_id,add_on_sale_id,receivable_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'receivable',v_receivable_id::text,v_sale.client_id,v_sale.project_id,v_add_on.id,v_sale.id,v_receivable_id,'system',coalesce(v_sale.seller_id,v_service.created_by),'add_on_recurring_receivable_generated','Cargo mensual generado','La automatizacion existente genero una obligacion mensual separada.',jsonb_build_object('periodKey',v_period),now());
    end if;
  end loop;
  return v_inserted;
end $$;

create or replace function public.billing_generate_recurring(p_horizon_days integer default 45,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_service record; v_base integer:=0; v_add_on integer:=0; v_today date;
begin
  if p_horizon_days not between 1 and 120 then raise exception 'invalid generation horizon' using errcode='22023'; end if;
  v_today:=(p_now at time zone 'America/Tegucigalpa')::date;
  for v_service in select id from public.project_recurring_services where status='active' order by id loop
    v_base:=v_base+private.generate_recurring_receivables_for_service(v_service.id,v_today+p_horizon_days);
  end loop;
  for v_service in select id from public.add_on_recurring_services where status='active' order by id loop
    v_add_on:=v_add_on+private.generate_add_on_recurring_receivables(v_service.id,v_today+p_horizon_days);
  end loop;
  return jsonb_build_object('created',v_base+v_add_on,'createdBase',v_base,'createdAddOns',v_add_on,'horizonDate',v_today+p_horizon_days);
end $$;
revoke all on function private.add_on_recurring_period_date(public.add_on_recurring_services,integer),private.generate_add_on_recurring_receivables(uuid,date) from public,anon,authenticated;
revoke all on function public.billing_generate_recurring(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_generate_recurring(integer,timestamptz) to service_role;

create or replace view public.project_commercial_value with (security_invoker=true) as
select p.id project_id,p.client_id,p.total_amount_minor original_project_minor,coalesce(sum(s.accepted_amount_minor),0)::bigint add_on_sales_minor,
  (p.total_amount_minor+coalesce(sum(s.accepted_amount_minor),0))::bigint lifetime_sold_minor,p.currency
from public.projects p left join public.add_on_sales s on s.project_id=p.id group by p.id;
grant select on public.project_commercial_value to authenticated;

create or replace function public.finance_add_on_summary(p_from date,p_to date)
returns table(original_project_sales_minor bigint,add_on_sales_minor bigint,lifetime_sold_minor bigint,add_on_collected_minor bigint,add_on_outstanding_minor bigint,base_recurring_collected_minor bigint,add_on_recurring_collected_minor bigint,currency text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if private.current_profile_role() not in ('owner','admin') then raise exception 'finance summary denied' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'invalid range' using errcode='22023'; end if;
  return query
  with original as (select coalesce(sum(p.total_amount_minor),0)::bigint amount from public.projects p where p.status<>'cancelled' and p.currency='USD' and coalesce(p.sold_at,p.effective_date) between p_from and p_to),
  additions as (select coalesce(sum(s.accepted_amount_minor),0)::bigint amount from public.add_on_sales s where s.currency='USD' and s.effective_date between p_from and p_to),
  addon_paid as (select coalesce(sum(pa.amount_minor),0)::bigint amount from public.payment_allocations pa join public.payments p on p.id=pa.payment_id join public.receivables r on r.id=pa.receivable_id where pa.reversed_at is null and p.status='posted' and p.paid_at::date between p_from and p_to and r.origin_type in ('add_on_installment','add_on_recurring')),
  addon_due as (select coalesce(sum(r.balance_minor),0)::bigint amount from public.receivables r where r.payment_state in ('open','partially_paid') and r.origin_type in ('add_on_installment','add_on_recurring') and r.due_date between p_from and p_to),
  base_recurring as (select coalesce(sum(pa.amount_minor),0)::bigint amount from public.payment_allocations pa join public.payments p on p.id=pa.payment_id join public.receivables r on r.id=pa.receivable_id where pa.reversed_at is null and p.status='posted' and p.paid_at::date between p_from and p_to and r.origin_type='recurring_service'),
  addon_recurring as (select coalesce(sum(pa.amount_minor),0)::bigint amount from public.payment_allocations pa join public.payments p on p.id=pa.payment_id join public.receivables r on r.id=pa.receivable_id where pa.reversed_at is null and p.status='posted' and p.paid_at::date between p_from and p_to and r.origin_type='add_on_recurring')
  select o.amount,a.amount,o.amount+a.amount,ap.amount,ad.amount,br.amount,ar.amount,'USD'::text from original o cross join additions a cross join addon_paid ap cross join addon_due ad cross join base_recurring br cross join addon_recurring ar;
end $$;
revoke all on function public.finance_add_on_summary(date,date) from public,anon;
grant execute on function public.finance_add_on_summary(date,date) to authenticated;

create or replace function public.finance_report(
  p_report text,p_from date,p_to date,p_currency text default null,p_client_id uuid default null,p_project_id uuid default null,
  p_seller_id uuid default null,p_payment_method text default null,p_category_id uuid default null,p_page integer default 1,p_page_size integer default 25
)
returns table(occurred_on date,record_type text,party text,concept text,project_name text,payment_method text,amount_minor bigint,currency text,status text,seller_id uuid,record_id uuid,total_count bigint)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if private.current_profile_role() not in ('owner','admin') then raise exception 'finance report denied' using errcode='42501'; end if;
  if p_report not in ('collections','receivables','overdue','expenses','cash_result','project_sales','seller','module_sales','module_collected','module_outstanding','module_recurring') then raise exception 'invalid report' using errcode='22023'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'invalid report range' using errcode='22023'; end if;
  if p_currency is not null and p_currency<>'USD' then raise exception 'report currency must be USD' using errcode='22023'; end if;
  if p_page<1 or p_page_size not between 1 and 200 then raise exception 'invalid pagination' using errcode='22023'; end if;
  return query with report_rows as (
    select p.paid_at::date occurred_on,'payment'::text record_type,coalesce(c.company,c.name) party,'Pago recibido'::text concept,''::text project_name,p.method::text payment_method,p.amount_minor,p.currency,p.status::text status,c.assigned_to seller_id,p.id record_id,c.id client_id,null::uuid project_id,null::uuid category_id
    from public.payments p join public.clients c on c.id=p.client_id where p_report in ('collections','cash_result','seller') and p.status='posted' and p.currency='USD'
    union all
    select r.due_date,'receivable',coalesce(c.company,c.name),r.description,pr.name,''::text,r.balance_minor,r.currency,r.payment_state::text,coalesce(pr.assigned_to,c.assigned_to),r.id,c.id,pr.id,null::uuid
    from public.receivables r join public.clients c on c.id=r.client_id join public.projects pr on pr.id=r.project_id where p_report in ('receivables','overdue') and r.payment_state in ('open','partially_paid') and (p_report<>'overdue' or r.due_date<current_date) and r.currency='USD'
    union all
    select e.expense_date,'expense',coalesce(nullif(e.vendor,''),'Sin proveedor'),e.description,coalesce(pr.name,''),e.payment_method::text,case when p_report='cash_result' then -e.amount_minor else e.amount_minor end,e.currency,e.status::text,pr.assigned_to,e.id,pr.client_id,pr.id,e.category_id
    from public.expenses e left join public.projects pr on pr.id=e.project_id where p_report in ('expenses','cash_result') and (p_report='expenses' or e.status='posted') and e.currency='USD'
    union all
    select coalesce(pr.sold_at,pr.effective_date),'project_sale',coalesce(c.company,c.name),pr.name,pr.name,''::text,pr.total_amount_minor,pr.currency,pr.status::text,coalesce(pr.assigned_to,c.assigned_to),pr.id,c.id,pr.id,null::uuid
    from public.projects pr join public.clients c on c.id=pr.client_id where p_report in ('project_sales','seller') and pr.status<>'cancelled' and pr.currency='USD'
    union all
    select s.effective_date,'module_sale',coalesce(c.company,c.name),a.name,pr.name,''::text,s.accepted_amount_minor,s.currency,'approved',s.seller_id,s.id,c.id,pr.id,null::uuid
    from public.add_on_sales s join public.project_add_ons a on a.id=s.add_on_id join public.clients c on c.id=s.client_id join public.projects pr on pr.id=s.project_id where p_report in ('module_sales','seller')
    union all
    select p.paid_at::date,'module_payment',coalesce(c.company,c.name),a.name,pr.name,p.method::text,pa.amount_minor,p.currency,p.status::text,s.seller_id,p.id,c.id,pr.id,null::uuid
    from public.payment_allocations pa join public.payments p on p.id=pa.payment_id join public.receivables r on r.id=pa.receivable_id join public.clients c on c.id=r.client_id join public.projects pr on pr.id=r.project_id left join public.add_on_installments ai on ai.id=r.add_on_installment_id left join public.add_on_payment_plans app on app.id=ai.payment_plan_id left join public.add_on_recurring_services ars on ars.id=r.add_on_recurring_service_id join public.add_on_sales s on s.id=coalesce(app.add_on_sale_id,ars.add_on_sale_id) join public.project_add_ons a on a.id=s.add_on_id where p_report in ('module_collected','module_recurring') and pa.reversed_at is null and p.status='posted' and (p_report<>'module_recurring' or r.origin_type='add_on_recurring')
    union all
    select r.due_date,'module_receivable',coalesce(c.company,c.name),a.name||' - '||r.description,pr.name,''::text,r.balance_minor,r.currency,r.payment_state::text,s.seller_id,r.id,c.id,pr.id,null::uuid
    from public.receivables r join public.clients c on c.id=r.client_id join public.projects pr on pr.id=r.project_id left join public.add_on_installments ai on ai.id=r.add_on_installment_id left join public.add_on_payment_plans app on app.id=ai.payment_plan_id left join public.add_on_recurring_services ars on ars.id=r.add_on_recurring_service_id join public.add_on_sales s on s.id=coalesce(app.add_on_sale_id,ars.add_on_sale_id) join public.project_add_ons a on a.id=s.add_on_id where p_report='module_outstanding' and r.origin_type in ('add_on_installment','add_on_recurring') and r.payment_state in ('open','partially_paid')
  ), filtered as (
    select * from report_rows r where r.occurred_on between p_from and p_to and (p_client_id is null or r.client_id=p_client_id) and (p_project_id is null or r.project_id=p_project_id) and (p_seller_id is null or r.seller_id=p_seller_id) and (p_payment_method is null or r.payment_method=p_payment_method) and (p_category_id is null or r.category_id=p_category_id)
  )
  select f.occurred_on,f.record_type,f.party,f.concept,f.project_name,f.payment_method,f.amount_minor,f.currency,f.status,f.seller_id,f.record_id,count(*) over() from filtered f order by f.occurred_on desc,f.record_id limit p_page_size offset (p_page-1)*p_page_size;
end $$;

comment on function public.billing_generate_recurring(integer,timestamptz) is 'Existing scheduler generator for independently traceable base and add-on recurring components.';
comment on function public.finance_add_on_summary(date,date) is 'USD-only breakdown that preserves original project sales and additional sales separately.';
