-- Stable form interactions are handled in the shared UI. This migration adds
-- auditable corrections for empty obligations and explicit recurring periods.

create table public.recurring_period_exceptions (
  id uuid primary key default gen_random_uuid(),
  project_recurring_service_id uuid references public.project_recurring_services(id) on delete restrict,
  add_on_recurring_service_id uuid references public.add_on_recurring_services(id) on delete restrict,
  receivable_id uuid not null references public.receivables(id) on delete restrict,
  period_key text not null,
  action text not null default 'cancelled' check (action = 'cancelled'),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint recurring_period_exception_origin check (
    (project_recurring_service_id is not null and add_on_recurring_service_id is null)
    or (project_recurring_service_id is null and add_on_recurring_service_id is not null)
  )
);

create unique index recurring_period_exceptions_base_idx
  on public.recurring_period_exceptions(project_recurring_service_id, period_key)
  where project_recurring_service_id is not null;
create unique index recurring_period_exceptions_add_on_idx
  on public.recurring_period_exceptions(add_on_recurring_service_id, period_key)
  where add_on_recurring_service_id is not null;
create unique index recurring_period_exceptions_receivable_idx
  on public.recurring_period_exceptions(receivable_id);

alter table public.recurring_period_exceptions enable row level security;
alter table public.recurring_period_exceptions force row level security;
grant select on public.recurring_period_exceptions to authenticated;

create policy recurring_period_exceptions_read_scoped
on public.recurring_period_exceptions for select to authenticated
using (
  (project_recurring_service_id is not null and exists (
    select 1 from public.project_recurring_services s
    where s.id = project_recurring_service_id and private.project_in_current_scope(s.project_id)
  ))
  or
  (add_on_recurring_service_id is not null and exists (
    select 1 from public.add_on_recurring_services s
    where s.id = add_on_recurring_service_id and private.add_on_sale_in_current_scope(s.add_on_sale_id)
  ))
);

create or replace function private.cancel_empty_receivable(
  p_receivable_id uuid,
  p_actor public.profiles,
  p_reason text,
  p_source text default 'manual_correction'
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_receivable public.receivables%rowtype;
  v_event_id uuid;
begin
  select * into v_receivable from public.receivables where id = p_receivable_id for update;
  if not found then raise exception 'receivable not found' using errcode = 'P0002'; end if;
  if v_receivable.payment_state = 'cancelled' then
    return jsonb_build_object('id', v_receivable.id, 'status', 'cancelled', 'changed', false);
  end if;
  if v_receivable.amount_paid_minor <> 0 or exists (
    select 1 from public.payment_allocations a
    where a.receivable_id = v_receivable.id and a.reversed_at is null
  ) then
    raise exception 'receivable with financial activity cannot be cancelled' using errcode = '55000';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'cancellation reason required' using errcode = '22023';
  end if;

  if v_receivable.recurring_service_id is not null then
    insert into public.recurring_period_exceptions(
      project_recurring_service_id, receivable_id, period_key, reason, created_by
    ) values (
      v_receivable.recurring_service_id, v_receivable.id, v_receivable.recurring_period_key,
      btrim(p_reason), p_actor.id
    )
    on conflict(project_recurring_service_id, period_key)
      where project_recurring_service_id is not null
    do update set receivable_id = excluded.receivable_id, reason = excluded.reason,
      created_by = excluded.created_by, created_at = now();
  elsif v_receivable.add_on_recurring_service_id is not null then
    insert into public.recurring_period_exceptions(
      add_on_recurring_service_id, receivable_id, period_key, reason, created_by
    ) values (
      v_receivable.add_on_recurring_service_id, v_receivable.id, v_receivable.recurring_period_key,
      btrim(p_reason), p_actor.id
    )
    on conflict(add_on_recurring_service_id, period_key)
      where add_on_recurring_service_id is not null
    do update set receivable_id = excluded.receivable_id, reason = excluded.reason,
      created_by = excluded.created_by, created_at = now();
  end if;

  update public.receivables
  set payment_state = 'cancelled', cancelled_at = now(), cancelled_by = p_actor.id,
      cancellation_reason = btrim(p_reason), notifications_enabled = false,
      schedule_version = schedule_version + 1
  where id = v_receivable.id;

  v_event_id := gen_random_uuid();
  insert into public.activity_logs(
    id, firebase_id, entity_type, entity_id, client_id, project_id, receivable_id,
    actor_id, actor_email, recipient_id, action, title, description, after_data, created_at
  ) values (
    v_event_id, 'supabase:' || v_event_id::text, 'receivable', v_receivable.id::text,
    v_receivable.client_id, v_receivable.project_id, v_receivable.id,
    p_actor.id, p_actor.email, p_actor.id, 'receivable_cancelled', 'Cobro cancelado',
    'La obligacion sin pagos fue cancelada y su historial se conservo.',
    jsonb_build_object('reason', btrim(p_reason), 'source', p_source,
      'periodKey', v_receivable.recurring_period_key), now()
  );
  return jsonb_build_object('id', v_receivable.id, 'status', 'cancelled', 'changed', true);
end;
$$;

create or replace function public.billing_correction_write(
  p_operation text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_actor public.profiles%rowtype;
  v_receivable public.receivables%rowtype;
  v_service_type text;
  v_service_id uuid;
  v_project_id uuid;
  v_client_id uuid;
  v_service_name text;
  v_reason text;
  v_cancel_future boolean;
  v_cancelled integer := 0;
  v_protected integer := 0;
  v_row record;
  v_event_id uuid;
  v_today date := (now() at time zone 'America/Tegucigalpa')::date;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid billing correction payload' using errcode = '22023';
  end if;
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found or v_actor.role not in ('owner', 'admin', 'manager') then
    raise exception 'billing correction forbidden' using errcode = '42501';
  end if;
  v_reason := btrim(coalesce(p_payload->>'reason', ''));
  if length(v_reason) < 3 then raise exception 'cancellation reason required' using errcode = '22023'; end if;

  if p_operation = 'receivable_cancel' then
    select * into v_receivable from public.receivables where id = (p_payload->>'id')::uuid;
    if not found then raise exception 'receivable not found' using errcode = 'P0002'; end if;
    return private.cancel_empty_receivable(v_receivable.id, v_actor, v_reason,
      case when v_receivable.recurring_service_id is not null or v_receivable.add_on_recurring_service_id is not null
        then 'recurring_period_correction' else 'manual_correction' end);

  elsif p_operation = 'recurring_service_deactivate' then
    v_service_type := p_payload->>'serviceType';
    v_service_id := (p_payload->>'serviceId')::uuid;
    v_cancel_future := coalesce((p_payload->>'cancelFuture')::boolean, false);

    if v_service_type = 'base' then
      select s.project_id, p.client_id, s.name into v_project_id, v_client_id, v_service_name
      from public.project_recurring_services s join public.projects p on p.id = s.project_id
      where s.id = v_service_id for update of s;
      if not found then raise exception 'recurring service not found' using errcode = 'P0002'; end if;
      update public.project_recurring_services set status = 'cancelled', updated_by = v_actor.id
      where id = v_service_id;
    elsif v_service_type = 'add_on' then
      select s.project_id, s.client_id, rs.name into v_project_id, v_client_id, v_service_name
      from public.add_on_recurring_services rs
      join public.add_on_sales s on s.id = rs.add_on_sale_id
      where rs.id = v_service_id for update of rs;
      if not found then raise exception 'recurring service not found' using errcode = 'P0002'; end if;
      update public.add_on_recurring_services set status = 'cancelled', updated_by = v_actor.id
      where id = v_service_id;
    else
      raise exception 'invalid recurring service type' using errcode = '22023';
    end if;

    if v_cancel_future then
      for v_row in
        select r.id, r.amount_paid_minor,
          exists(select 1 from public.payment_allocations a where a.receivable_id = r.id and a.reversed_at is null) as has_allocation
        from public.receivables r
        where ((v_service_type = 'base' and r.recurring_service_id = v_service_id)
          or (v_service_type = 'add_on' and r.add_on_recurring_service_id = v_service_id))
          and r.due_date > v_today and r.payment_state <> 'cancelled'
        order by r.due_date, r.id for update
      loop
        if v_row.amount_paid_minor = 0 and not v_row.has_allocation then
          perform private.cancel_empty_receivable(v_row.id, v_actor, v_reason, 'service_deactivation');
          v_cancelled := v_cancelled + 1;
        else
          v_protected := v_protected + 1;
        end if;
      end loop;
    else
      select count(*) into v_protected from public.receivables r
      where ((v_service_type = 'base' and r.recurring_service_id = v_service_id)
        or (v_service_type = 'add_on' and r.add_on_recurring_service_id = v_service_id))
        and r.due_date > v_today and r.payment_state <> 'cancelled';
    end if;

    v_event_id := gen_random_uuid();
    insert into public.activity_logs(
      id, firebase_id, entity_type, entity_id, client_id, project_id, actor_id,
      actor_email, recipient_id, action, title, description, after_data, created_at
    ) values (
      v_event_id, 'supabase:' || v_event_id::text, 'recurring_service', v_service_id::text,
      v_client_id, v_project_id, v_actor.id, v_actor.email, v_actor.id,
      'recurring_service_deactivated', 'Servicio recurrente desactivado',
      'El servicio dejo de generar nuevos Cobros; los periodos con pagos se conservaron.',
      jsonb_build_object('serviceType', v_service_type, 'serviceName', v_service_name,
        'cancelFuture', v_cancel_future, 'cancelledFuture', v_cancelled,
        'preservedFuture', v_protected, 'reason', v_reason), now()
    );
    return jsonb_build_object('id', v_service_id, 'status', 'cancelled',
      'cancelledFuture', v_cancelled, 'preservedFuture', v_protected);
  end if;
  raise exception 'unsupported billing correction operation' using errcode = '22023';
end;
$$;

create or replace function public.billing_correction_preview(
  p_service_type text,
  p_service_id uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_actor public.profiles%rowtype;
  v_exists boolean;
  v_total integer;
  v_cancellable integer;
  v_today date := (now() at time zone 'America/Tegucigalpa')::date;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found or v_actor.role not in ('owner', 'admin', 'manager') then
    raise exception 'billing correction preview forbidden' using errcode = '42501';
  end if;
  if p_service_type = 'base' then
    select exists(select 1 from public.project_recurring_services where id = p_service_id) into v_exists;
  elsif p_service_type = 'add_on' then
    select exists(select 1 from public.add_on_recurring_services where id = p_service_id) into v_exists;
  else
    raise exception 'invalid recurring service type' using errcode = '22023';
  end if;
  if not v_exists then raise exception 'recurring service not found' using errcode = 'P0002'; end if;

  select count(*), count(*) filter (
    where r.amount_paid_minor = 0 and not exists (
      select 1 from public.payment_allocations a
      where a.receivable_id = r.id and a.reversed_at is null
    )
  ) into v_total, v_cancellable
  from public.receivables r
  where ((p_service_type = 'base' and r.recurring_service_id = p_service_id)
    or (p_service_type = 'add_on' and r.add_on_recurring_service_id = p_service_id))
    and r.due_date > v_today and r.payment_state <> 'cancelled';

  return jsonb_build_object('total', v_total, 'cancellable', v_cancellable,
    'protected', v_total - v_cancellable);
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
    continue when exists(select 1 from public.recurring_period_exceptions e
      where e.project_recurring_service_id=v_service.id and e.period_key=v_period);
    insert into public.receivables(client_id,project_id,origin_type,recurring_service_id,recurring_period_key,description,amount_due_minor,currency,due_date,due_time,due_timezone,notifications_enabled,created_by,metadata)
    values(v_project.client_id,v_project.id,'recurring_service',v_service.id,v_period,v_service.name,v_service.monthly_amount_minor,v_service.currency,v_due,v_service.billing_time,v_service.timezone,true,v_service.updated_by,jsonb_build_object('frequency',v_service.frequency))
    on conflict(recurring_service_id,recurring_period_key) where recurring_service_id is not null do nothing
    returning id into v_receivable_id;
    if found then
      v_inserted:=v_inserted+1;
      v_event_id:=gen_random_uuid();
      insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,project_id,receivable_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
      values(v_event_id,'supabase:'||v_event_id::text,'receivable',v_receivable_id::text,v_project.client_id,v_project.id,v_receivable_id,null,'system',coalesce(v_project.assigned_to,v_project.created_by),
        'recurring_receivable_generated','Mensualidad generada','La automatizacion genero una cuenta por cobrar recurrente.',jsonb_build_object('periodKey',v_period),now());
    end if;
  end loop;
  return v_inserted;
end;
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
    continue when exists(select 1 from public.recurring_period_exceptions e
      where e.add_on_recurring_service_id=v_service.id and e.period_key=v_period);
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
end;
$$;

revoke all on function private.cancel_empty_receivable(uuid,public.profiles,text,text) from public,anon,authenticated;
revoke all on function public.billing_correction_write(text,jsonb) from public,anon;
grant execute on function public.billing_correction_write(text,jsonb) to authenticated;
revoke all on function public.billing_correction_preview(text,uuid) from public,anon;
grant execute on function public.billing_correction_preview(text,uuid) to authenticated;
revoke all on function private.generate_recurring_receivables_for_service(uuid,date),private.generate_add_on_recurring_receivables(uuid,date) from public,anon,authenticated;

comment on table public.recurring_period_exceptions is
  'Auditable suppression for a cancelled recurring period. It prevents the same period from being regenerated.';
comment on function public.billing_correction_write(text,jsonb) is
  'Cancels empty obligations and deactivates recurring services without deleting payment history.';
comment on function public.billing_correction_preview(text,uuid) is
  'Returns the authoritative impact before deactivating a recurring service.';
