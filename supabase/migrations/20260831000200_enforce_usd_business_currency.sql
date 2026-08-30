-- Ken Code business policy: USD is the sole operational currency.
-- Keep ISO currency columns and minor-unit amounts for accounting integrity and
-- future policy changes, while rejecting every non-USD commercial mutation.

create or replace function private.enforce_usd_business_currency()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.currency is distinct from 'USD' then
    raise exception 'Ken Code business currency must be USD' using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table public.projects alter column currency set default 'USD';
alter table public.project_payment_plans alter column currency set default 'USD';
alter table public.project_installments alter column currency set default 'USD';
alter table public.project_recurring_services alter column currency set default 'USD';
alter table public.receivables alter column currency set default 'USD';
alter table public.payments alter column currency set default 'USD';
alter table public.expenses alter column currency set default 'USD';

alter table public.projects add constraint projects_currency_usd check (currency = 'USD');
alter table public.project_payment_plans add constraint project_payment_plans_currency_usd check (currency = 'USD');
alter table public.project_installments add constraint project_installments_currency_usd check (currency = 'USD');
alter table public.project_recurring_services add constraint project_recurring_services_currency_usd check (currency = 'USD');
alter table public.receivables add constraint receivables_currency_usd check (currency = 'USD');
alter table public.payments add constraint payments_currency_usd check (currency = 'USD');
alter table public.expenses add constraint expenses_currency_usd check (currency = 'USD');

create trigger projects_enforce_usd before insert or update of currency on public.projects
for each row execute function private.enforce_usd_business_currency();
create trigger project_payment_plans_enforce_usd before insert or update of currency on public.project_payment_plans
for each row execute function private.enforce_usd_business_currency();
create trigger project_installments_enforce_usd before insert or update of currency on public.project_installments
for each row execute function private.enforce_usd_business_currency();
create trigger project_recurring_services_enforce_usd before insert or update of currency on public.project_recurring_services
for each row execute function private.enforce_usd_business_currency();
create trigger receivables_enforce_usd before insert or update of currency on public.receivables
for each row execute function private.enforce_usd_business_currency();
create trigger payments_enforce_usd before insert or update of currency on public.payments
for each row execute function private.enforce_usd_business_currency();
create trigger expenses_enforce_usd before insert or update of currency on public.expenses
for each row execute function private.enforce_usd_business_currency();

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
  with totals as (
    select
      coalesce((select sum(p.total_amount_minor) from public.projects p where p.currency='USD' and p.status<>'cancelled' and coalesce(p.sold_at::date,p.effective_date) between p_from and p_to),0)::bigint sold,
      coalesce((select sum(p.amount_minor) from public.payments p where p.currency='USD' and p.status='posted' and p.paid_at::date between p_from and p_to),0)::bigint collected,
      coalesce((select sum(r.balance_minor) from public.receivables r where r.currency='USD' and r.payment_state in ('open','partially_paid') and r.due_date between p_from and p_to),0)::bigint outstanding,
      coalesce((select sum(r.balance_minor) from public.receivables r where r.currency='USD' and r.payment_state in ('open','partially_paid') and r.due_date < current_date and r.due_date between p_from and p_to),0)::bigint overdue,
      coalesce((select sum(a.amount_minor) from public.payment_allocations a join public.payments p on p.id=a.payment_id and p.status='posted' and p.currency='USD' join public.receivables r on r.id=a.receivable_id and r.origin_type='recurring_service' where a.reversed_at is null and p.paid_at::date between p_from and p_to),0)::bigint recurring,
      coalesce((select sum(e.amount_minor) from public.expenses e where e.currency='USD' and e.status='posted' and e.expense_date between p_from and p_to),0)::bigint spent
  )
  select 'USD'::text,t.sold,t.collected,t.outstanding,t.overdue,t.recurring,t.spent,t.collected-t.spent from totals t;
end;
$$;

create or replace function public.finance_monthly_series(p_from date,p_to date,p_currency text)
returns table(month_start date,collected_minor bigint,expense_minor bigint)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if private.current_profile_role() not in ('owner','admin') then raise exception 'finance report denied' using errcode='42501'; end if;
  if p_currency <> 'USD' or p_to<p_from or p_to-p_from>1096 then raise exception 'finance series currency must be USD' using errcode='22023'; end if;
  return query
  with months as (select generate_series(date_trunc('month',p_from::timestamp),date_trunc('month',p_to::timestamp),interval '1 month')::date month_start),
  collected as (select date_trunc('month',paid_at)::date m,sum(amount_minor)::bigint amount from public.payments where status='posted' and currency='USD' and paid_at::date between p_from and p_to group by 1),
  spent as (select date_trunc('month',expense_date)::date m,sum(amount_minor)::bigint amount from public.expenses where status='posted' and currency='USD' and expense_date between p_from and p_to group by 1)
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
  if p_currency is not null and p_currency <> 'USD' then raise exception 'report currency must be USD' using errcode='22023'; end if;
  if p_page<1 or p_page_size not between 1 and 200 then raise exception 'invalid pagination' using errcode='22023'; end if;
  return query
  with report_rows as (
    select p.paid_at::date occurred_on,'payment'::text record_type,coalesce(c.company,c.name) party,'Pago recibido'::text concept,
      ''::text project_name,p.method::text payment_method,p.amount_minor,p.currency,p.status::text status,c.assigned_to seller_id,p.id record_id,c.id client_id,null::uuid project_id,null::uuid category_id
    from public.payments p join public.clients c on c.id=p.client_id
    where p_report in ('collections','cash_result','seller') and p.status='posted' and p.currency='USD'
    union all
    select r.due_date,'receivable',coalesce(c.company,c.name),r.description,pr.name,''::text,r.balance_minor,r.currency,r.payment_state::text,coalesce(pr.assigned_to,c.assigned_to),r.id,c.id,pr.id,null::uuid
    from public.receivables r join public.clients c on c.id=r.client_id join public.projects pr on pr.id=r.project_id
    where p_report in ('receivables','overdue') and r.payment_state in ('open','partially_paid') and (p_report<>'overdue' or r.due_date<current_date) and r.currency='USD'
    union all
    select e.expense_date,'expense',coalesce(nullif(e.vendor,''),'Sin proveedor'),e.description,coalesce(pr.name,''),e.payment_method::text,
      case when p_report='cash_result' then -e.amount_minor else e.amount_minor end,e.currency,e.status::text,pr.assigned_to,e.id,pr.client_id,pr.id,e.category_id
    from public.expenses e left join public.projects pr on pr.id=e.project_id
    where p_report in ('expenses','cash_result') and (p_report='expenses' or e.status='posted') and e.currency='USD'
    union all
    select coalesce(pr.sold_at::date,pr.effective_date),'project_sale',coalesce(c.company,c.name),pr.name,pr.name,''::text,pr.total_amount_minor,pr.currency,pr.status::text,coalesce(pr.assigned_to,c.assigned_to),pr.id,c.id,pr.id,null::uuid
    from public.projects pr join public.clients c on c.id=pr.client_id where p_report in ('project_sales','seller') and pr.status<>'cancelled' and pr.currency='USD'
  ), filtered as (
    select * from report_rows r where r.occurred_on between p_from and p_to
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

comment on function private.enforce_usd_business_currency() is 'Rejects non-USD values at the database boundary for every current monetary business entity.';
comment on function public.finance_summary(date,date) is 'Owner/Admin USD-only summary; sold value, cash collected, obligations, expenses and net cash remain distinct.';
comment on function public.finance_report(text,date,date,text,uuid,uuid,uuid,text,uuid,integer,integer) is 'Server-filtered and paginated USD-only finance reporting layer.';
