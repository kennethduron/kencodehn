-- Owner usability: auditable, communication-safe historical data sessions.
create type public.historical_import_status as enum ('active', 'completed');

create table public.historical_import_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  status public.historical_import_status not null default 'active',
  previous_billing_notifications_enabled boolean not null,
  reminders_reenabled boolean not null default false,
  started_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_by uuid references public.profiles(id) on delete restrict,
  completed_at timestamptz,
  skipped_reminder_events integer not null default 0 check (skipped_reminder_events >= 0),
  metadata jsonb not null default '{}'::jsonb,
  constraint historical_import_completion_consistent check (
    (status = 'active' and completed_by is null and completed_at is null)
    or (status = 'completed' and completed_by is not null and completed_at is not null)
  )
);

create unique index historical_import_one_active_client
  on public.historical_import_sessions(client_id)
  where status = 'active';
create index historical_import_client_started_idx
  on public.historical_import_sessions(client_id, started_at desc);

alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check (entity_type in (
  'lead','note','task','notification','user','system','client','project','payment_plan','recurring_service',
  'receivable','payment','billing','expense','expense_category','finance_report','module','proposal',
  'add_on_sale','add_on_payment_plan','add_on_recurring','historical_import'
));

alter table public.historical_import_sessions enable row level security;
alter table public.historical_import_sessions force row level security;
grant select on public.historical_import_sessions to authenticated;
create policy historical_import_owner_admin_read
  on public.historical_import_sessions for select to authenticated
  using (private.current_profile_role() in ('owner', 'admin'));

create or replace function public.historical_import_start(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_client public.clients%rowtype;
  v_session public.historical_import_sessions%rowtype;
  v_event_id uuid;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'historical import forbidden' using errcode = '42501';
  end if;

  select * into v_client from public.clients where id = p_client_id for update;
  if not found then raise exception 'client not found' using errcode = 'P0002'; end if;

  select * into v_session
    from public.historical_import_sessions
    where client_id = p_client_id and status = 'active'
    for update;

  if found then
    if v_client.billing_notifications_enabled then
      update public.clients set billing_notifications_enabled = false where id = p_client_id;
    end if;
    return jsonb_build_object(
      'id', v_session.id,
      'clientId', v_session.client_id,
      'status', v_session.status,
      'startedAt', v_session.started_at,
      'remindersPaused', true,
      'resumed', true
    );
  end if;

  insert into public.historical_import_sessions(
    client_id, previous_billing_notifications_enabled, started_by
  ) values (
    p_client_id, v_client.billing_notifications_enabled, v_actor.id
  ) returning * into v_session;

  update public.clients set billing_notifications_enabled = false where id = p_client_id;

  v_event_id := gen_random_uuid();
  insert into public.activity_logs(
    id, firebase_id, entity_type, entity_id, client_id, actor_id, actor_email,
    recipient_id, action, title, description, after_data, created_at
  ) values (
    v_event_id, 'supabase:' || v_event_id::text, 'historical_import', v_session.id::text,
    p_client_id, v_actor.id, v_actor.email, v_actor.id,
    'historical_import_started', 'Registro histórico iniciado',
    'Los recordatorios del cliente quedaron pausados mientras se registra su información anterior.',
    jsonb_build_object('remindersPaused', true), now()
  );

  return jsonb_build_object(
    'id', v_session.id,
    'clientId', v_session.client_id,
    'status', v_session.status,
    'startedAt', v_session.started_at,
    'remindersPaused', true,
    'resumed', false
  );
end;
$$;

create or replace function public.historical_import_complete(
  p_session_id uuid,
  p_enable_reminders boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_session public.historical_import_sessions%rowtype;
  v_skipped integer := 0;
  v_pending_minor bigint := 0;
  v_overdue_minor bigint := 0;
  v_next_due date;
  v_next_amount bigint;
  v_event_id uuid;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'historical import forbidden' using errcode = '42501';
  end if;

  select * into v_session from public.historical_import_sessions
    where id = p_session_id for update;
  if not found then raise exception 'historical import not found' using errcode = 'P0002'; end if;
  if v_session.status = 'completed' then
    return jsonb_build_object(
      'id', v_session.id, 'status', v_session.status,
      'remindersEnabled', v_session.reminders_reenabled,
      'skippedReminderEvents', v_session.skipped_reminder_events
    );
  end if;

  update public.billing_reminder_events e
    set state = case when e.state = 'processing'
      then 'superseded'::public.billing_event_state
      else 'skipped'::public.billing_event_state end,
      skipped_reason = 'historical_import',
      retry_at = null,
      lease_token = null,
      lease_expires_at = null
  from public.receivables r
  where r.id = e.receivable_id
    and r.client_id = v_session.client_id
    and r.created_at >= v_session.started_at
    and e.scheduled_at <= now()
    and e.state in ('scheduled', 'failed', 'processing');
  get diagnostics v_skipped = row_count;

  select coalesce(sum(balance_minor), 0),
         coalesce(sum(balance_minor) filter (where due_date < current_date), 0)
    into v_pending_minor, v_overdue_minor
    from public.receivables
    where client_id = v_session.client_id
      and payment_state in ('open', 'partially_paid');

  select due_date, balance_minor into v_next_due, v_next_amount
    from public.receivables
    where client_id = v_session.client_id
      and payment_state in ('open', 'partially_paid')
      and due_date >= current_date
    order by due_date, id limit 1;

  update public.clients
    set billing_notifications_enabled = p_enable_reminders
    where id = v_session.client_id;

  update public.historical_import_sessions
    set status = 'completed', completed_by = v_actor.id, completed_at = now(),
        reminders_reenabled = p_enable_reminders,
        skipped_reminder_events = v_skipped,
        metadata = jsonb_build_object(
          'pendingMinor', v_pending_minor,
          'overdueMinor', v_overdue_minor,
          'nextDueDate', v_next_due,
          'nextDueMinor', v_next_amount
        )
    where id = v_session.id;

  v_event_id := gen_random_uuid();
  insert into public.activity_logs(
    id, firebase_id, entity_type, entity_id, client_id, actor_id, actor_email,
    recipient_id, action, title, description, after_data, created_at
  ) values (
    v_event_id, 'supabase:' || v_event_id::text, 'historical_import', v_session.id::text,
    v_session.client_id, v_actor.id, v_actor.email, v_actor.id,
    'historical_import_completed', 'Registro histórico finalizado',
    case when p_enable_reminders
      then 'La información histórica quedó registrada y los recordatorios futuros fueron activados por decisión explícita.'
      else 'La información histórica quedó registrada y los recordatorios permanecen pausados.' end,
    jsonb_build_object(
      'remindersEnabled', p_enable_reminders,
      'pendingMinor', v_pending_minor,
      'overdueMinor', v_overdue_minor,
      'skippedReminderEvents', v_skipped
    ), now()
  );

  return jsonb_build_object(
    'id', v_session.id,
    'status', 'completed',
    'remindersEnabled', p_enable_reminders,
    'pendingMinor', v_pending_minor,
    'overdueMinor', v_overdue_minor,
    'nextDueDate', v_next_due,
    'nextDueMinor', v_next_amount,
    'skippedReminderEvents', v_skipped
  );
end;
$$;

revoke all on function public.historical_import_start(uuid) from public, anon;
revoke all on function public.historical_import_complete(uuid, boolean) from public, anon;
grant execute on function public.historical_import_start(uuid) to authenticated;
grant execute on function public.historical_import_complete(uuid, boolean) to authenticated;

create or replace function public.historical_add_on_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_session public.historical_import_sessions%rowtype;
  v_add_on_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_sale_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_recurring_id uuid;
  v_item jsonb;
  v_sum bigint := 0;
  v_amount bigint;
  v_effective_date date;
  v_work_status public.add_on_work_status;
begin
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'historical add-on forbidden' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = (p_payload->>'projectId')::uuid;
  if not found or v_project.client_id <> (p_payload->>'clientId')::uuid then
    raise exception 'invalid client project relationship' using errcode = '23514';
  end if;
  select * into v_session from public.historical_import_sessions
    where id = (p_payload->>'sessionId')::uuid
      and client_id = v_project.client_id and status = 'active'
    for update;
  if not found then raise exception 'active historical import required' using errcode = '55000'; end if;
  if coalesce(p_payload->>'currency', 'USD') <> 'USD' then
    raise exception 'historical add-on currency must be USD' using errcode = '23514';
  end if;
  v_amount := (p_payload->>'amountMinor')::bigint;
  v_effective_date := (p_payload->>'effectiveDate')::date;
  v_work_status := coalesce(nullif(p_payload->>'workStatus', '')::public.add_on_work_status, 'pending');
  if v_amount <= 0 or v_effective_date > current_date then
    raise exception 'invalid historical sale terms' using errcode = '22023';
  end if;

  insert into public.project_add_ons(
    id, project_id, client_id, name, description, request_date, requested_by_client,
    commercial_status, work_status, quoted_amount_minor, accepted_amount_minor, currency,
    accepted_proposal_id, assigned_sales_agent_id, effective_date, actual_delivery_date,
    created_by, approved_at, approved_by, delivered_at, delivered_by, delivery_notes, notes
  ) values (
    v_add_on_id, v_project.id, v_project.client_id, btrim(p_payload->>'name'),
    coalesce(p_payload->>'description', ''), (p_payload->>'requestDate')::date,
    coalesce((p_payload->>'requestedByClient')::boolean, true), 'approved', v_work_status,
    v_amount, v_amount, 'USD', null, v_project.assigned_to, v_effective_date,
    case when v_work_status = 'delivered' then coalesce(nullif(p_payload->>'actualDeliveryDate', '')::date, v_effective_date) else null end,
    v_actor.id, now(), v_actor.id,
    case when v_work_status = 'delivered' then now() else null end,
    case when v_work_status = 'delivered' then v_actor.id else null end,
    coalesce(p_payload->>'deliveryNotes', ''), 'Registrado mediante el flujo de información histórica.'
  );

  insert into public.add_on_proposals(
    id, add_on_id, version, status, title, scope_description, amount_minor, currency,
    payment_terms, monthly_add_on_minor, estimated_delivery, client_notes, internal_notes,
    created_by, decided_at, decided_by, decision_notes
  ) values (
    v_proposal_id, v_add_on_id, 1, 'accepted', btrim(p_payload->>'name'),
    coalesce(nullif(btrim(p_payload->>'description'), ''), btrim(p_payload->>'name')),
    v_amount, 'USD', coalesce(p_payload->>'paymentTerms', ''),
    coalesce(nullif(p_payload->>'monthlyAddOnMinor', '')::bigint, 0),
    coalesce(p_payload->>'estimatedDelivery', ''), '',
    'Acuerdo anterior al uso del CRM; capturado sin enviar comunicación.',
    v_actor.id, now(), v_actor.id, 'Acuerdo histórico registrado por Owner/Admin.'
  );
  update public.project_add_ons set accepted_proposal_id = v_proposal_id where id = v_add_on_id;

  insert into public.add_on_sales(
    id, add_on_id, proposal_id, client_id, project_id, accepted_amount_minor,
    currency, seller_id, effective_date, approved_by, approved_at
  ) values (
    v_sale_id, v_add_on_id, v_proposal_id, v_project.client_id, v_project.id,
    v_amount, 'USD', v_project.assigned_to, v_effective_date, v_actor.id, now()
  );

  if jsonb_typeof(p_payload->'installments') <> 'array' or jsonb_array_length(p_payload->'installments') < 1 then
    raise exception 'historical installments required' using errcode = '22023';
  end if;
  insert into public.add_on_payment_plans(
    id, add_on_sale_id, version, name, status, planned_total_minor, currency,
    created_by, activated_by, activated_at
  ) values (
    v_plan_id, v_sale_id, 1, 'Plan histórico', 'active', v_amount, 'USD',
    v_actor.id, v_actor.id, now()
  );
  for v_item in select value from jsonb_array_elements(p_payload->'installments') loop
    if coalesce(v_item->>'currency', 'USD') <> 'USD' then
      raise exception 'historical installment currency must be USD' using errcode = '23514';
    end if;
    insert into public.add_on_installments(
      payment_plan_id, sequence, label, amount_minor, currency, due_date, due_time, notes
    ) values (
      v_plan_id, (v_item->>'sequence')::integer, btrim(v_item->>'label'),
      (v_item->>'amountMinor')::bigint, 'USD', (v_item->>'dueDate')::date,
      nullif(v_item->>'dueTime', '')::time, coalesce(v_item->>'notes', '')
    );
    v_sum := v_sum + (v_item->>'amountMinor')::bigint;
  end loop;
  if v_sum <> v_amount then raise exception 'historical installment total mismatch' using errcode = '23514'; end if;

  insert into public.receivables(
    client_id, project_id, origin_type, add_on_installment_id, description,
    amount_due_minor, currency, due_date, due_time, due_timezone,
    notifications_enabled, created_by, metadata
  )
  select v_project.client_id, v_project.id, 'add_on_installment', i.id,
    btrim(p_payload->>'name') || ' - ' || i.label, i.amount_minor, 'USD',
    i.due_date, i.due_time, 'America/Tegucigalpa', true, v_actor.id,
    jsonb_build_object('addOnId', v_add_on_id, 'saleId', v_sale_id, 'planId', v_plan_id, 'historicalImportId', v_session.id)
  from public.add_on_installments i where i.payment_plan_id = v_plan_id;

  if coalesce(nullif(p_payload->>'monthlyAddOnMinor', '')::bigint, 0) > 0 then
    v_recurring_id := gen_random_uuid();
    insert into public.add_on_recurring_services(
      id, add_on_sale_id, name, monthly_amount_minor, currency, start_date,
      billing_day, billing_time, timezone, status, created_by, updated_by
    ) values (
      v_recurring_id, v_sale_id, btrim(p_payload->>'name') || ' mensual',
      (p_payload->>'monthlyAddOnMinor')::bigint, 'USD',
      (p_payload->>'monthlyStartDate')::date, (p_payload->>'monthlyBillingDay')::smallint,
      coalesce(nullif(p_payload->>'monthlyBillingTime', '')::time, '09:00'),
      'America/Tegucigalpa', 'active', v_actor.id, v_actor.id
    );
    perform private.generate_add_on_recurring_receivables(v_recurring_id, current_date + 45);
  end if;

  perform private.phase4_activity(
    'add_on_sale', v_sale_id, v_project.client_id, v_project.id, v_add_on_id,
    v_proposal_id, v_sale_id, 'historical_module_sale_registered',
    'Venta histórica de módulo registrada',
    'Se preservaron el acuerdo, la venta, el plan y sus cobros sin enviar comunicaciones.',
    null, jsonb_build_object('effectiveDate', v_effective_date, 'amountMinor', v_amount, 'historicalImportId', v_session.id), v_actor
  );
  return jsonb_build_object(
    'addOnId', v_add_on_id, 'proposalId', v_proposal_id, 'saleId', v_sale_id,
    'planId', v_plan_id, 'effectiveDate', v_effective_date
  );
end;
$$;

revoke all on function public.historical_add_on_create(jsonb) from public, anon;
grant execute on function public.historical_add_on_create(jsonb) to authenticated;

comment on table public.historical_import_sessions is
  'Auditable Owner/Admin workflow that pauses client reminders while existing business history is recorded.';
comment on function public.historical_import_complete(uuid, boolean) is
  'Completes a historical session, skips elapsed reminder windows created during it, and only reenables reminders explicitly.';
comment on function public.historical_add_on_create(jsonb) is
  'Owner/Admin-only historical add-on capture that preserves proposal, sale, plan and receivable entities without sending communications.';
