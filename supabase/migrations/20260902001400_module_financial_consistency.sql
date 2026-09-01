-- Module financial consistency and safe completion of an existing historical module.

create or replace function public.historical_add_on_complete_existing(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_session public.historical_import_sessions%rowtype;
  v_add_on public.project_add_ons%rowtype;
  v_proposal_id uuid := gen_random_uuid();
  v_sale_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_recurring_id uuid;
  v_item jsonb;
  v_sum bigint := 0;
  v_amount bigint;
  v_effective_date date;
  v_work_status public.add_on_work_status;
  v_version integer;
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

  select * into v_add_on from public.project_add_ons
    where id = (p_payload->>'existingAddOnId')::uuid for update;
  if not found or v_add_on.client_id <> v_project.client_id or v_add_on.project_id <> v_project.id then
    raise exception 'existing module is outside the selected client/project' using errcode = '23514';
  end if;
  if v_add_on.commercial_status in ('approved','rejected','cancelled')
     or exists(select 1 from public.add_on_sales where add_on_id = v_add_on.id) then
    raise exception 'existing module already has definitive commercial history' using errcode = '55000';
  end if;
  if exists(select 1 from public.add_on_proposals where add_on_id = v_add_on.id and status <> 'draft') then
    raise exception 'existing module has proposal history that must be preserved' using errcode = '55000';
  end if;
  if coalesce(p_payload->>'currency', 'USD') <> 'USD' then
    raise exception 'historical add-on currency must be USD' using errcode = '23514';
  end if;
  v_amount := (p_payload->>'amountMinor')::bigint;
  v_effective_date := (p_payload->>'effectiveDate')::date;
  v_work_status := coalesce(nullif(p_payload->>'workStatus', '')::public.add_on_work_status, v_add_on.work_status);
  if v_amount <= 0 or v_effective_date > current_date then
    raise exception 'invalid historical sale terms' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'installments') <> 'array' or jsonb_array_length(p_payload->'installments') < 1 then
    raise exception 'historical installments required' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.add_on_proposals where add_on_id = v_add_on.id;
  update public.add_on_proposals set status = 'superseded'
    where add_on_id = v_add_on.id and status = 'draft';
  insert into public.add_on_proposals(
    id, add_on_id, version, status, title, scope_description, amount_minor, currency,
    payment_terms, monthly_add_on_minor, estimated_delivery, client_notes, internal_notes,
    created_by, decided_at, decided_by, decision_notes
  ) values (
    v_proposal_id, v_add_on.id, v_version, 'accepted', btrim(p_payload->>'name'),
    coalesce(nullif(btrim(p_payload->>'description'), ''), v_add_on.description, v_add_on.name),
    v_amount, 'USD', coalesce(p_payload->>'paymentTerms', ''),
    coalesce(nullif(p_payload->>'monthlyAddOnMinor', '')::bigint, 0),
    coalesce(p_payload->>'estimatedDelivery', ''), '',
    'Acuerdo anterior al uso del CRM; capturado sin enviar comunicación.',
    v_actor.id, now(), v_actor.id, 'Acuerdo histórico registrado por Owner/Admin.'
  );

  update public.project_add_ons set
    description = coalesce(nullif(btrim(p_payload->>'description'), ''), description),
    request_date = (p_payload->>'requestDate')::date,
    commercial_status = 'approved', work_status = v_work_status,
    quoted_amount_minor = v_amount, accepted_amount_minor = v_amount,
    accepted_proposal_id = v_proposal_id, effective_date = v_effective_date,
    actual_delivery_date = case when v_work_status = 'delivered' then coalesce(nullif(p_payload->>'actualDeliveryDate', '')::date, v_effective_date) else actual_delivery_date end,
    approved_at = now(), approved_by = v_actor.id,
    delivered_at = case when v_work_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    delivered_by = case when v_work_status = 'delivered' then coalesce(delivered_by, v_actor.id) else delivered_by end,
    delivery_notes = coalesce(nullif(p_payload->>'deliveryNotes', ''), delivery_notes),
    notes = concat_ws(E'\n', nullif(notes, ''), 'Venta histórica completada sobre el módulo existente.')
  where id = v_add_on.id;

  insert into public.add_on_sales(
    id, add_on_id, proposal_id, client_id, project_id, accepted_amount_minor,
    currency, seller_id, effective_date, approved_by, approved_at
  ) values (
    v_sale_id, v_add_on.id, v_proposal_id, v_project.client_id, v_project.id,
    v_amount, 'USD', coalesce(v_add_on.assigned_sales_agent_id, v_project.assigned_to),
    v_effective_date, v_actor.id, now()
  );
  insert into public.add_on_payment_plans(
    id, add_on_sale_id, version, name, status, planned_total_minor, currency,
    created_by, activated_by, activated_at
  ) values (v_plan_id, v_sale_id, 1, 'Plan histórico', 'active', v_amount, 'USD', v_actor.id, v_actor.id, now());

  for v_item in select value from jsonb_array_elements(p_payload->'installments') loop
    if coalesce(v_item->>'currency', 'USD') <> 'USD' then
      raise exception 'historical installment currency must be USD' using errcode = '23514';
    end if;
    insert into public.add_on_installments(payment_plan_id, sequence, label, amount_minor, currency, due_date, due_time, notes)
    values (v_plan_id, (v_item->>'sequence')::integer, btrim(v_item->>'label'),
      (v_item->>'amountMinor')::bigint, 'USD', (v_item->>'dueDate')::date,
      nullif(v_item->>'dueTime', '')::time, coalesce(v_item->>'notes', ''));
    v_sum := v_sum + (v_item->>'amountMinor')::bigint;
  end loop;
  if v_sum <> v_amount then raise exception 'historical installment total mismatch' using errcode = '23514'; end if;

  insert into public.receivables(
    client_id, project_id, origin_type, add_on_installment_id, description,
    amount_due_minor, currency, due_date, due_time, due_timezone,
    notifications_enabled, created_by, metadata
  )
  select v_project.client_id, v_project.id, 'add_on_installment', i.id,
    v_add_on.name || ' - ' || i.label, i.amount_minor, 'USD', i.due_date, i.due_time,
    'America/Tegucigalpa', true, v_actor.id,
    jsonb_build_object('addOnId', v_add_on.id, 'saleId', v_sale_id, 'planId', v_plan_id, 'historicalImportId', v_session.id)
  from public.add_on_installments i where i.payment_plan_id = v_plan_id;

  if coalesce(nullif(p_payload->>'monthlyAddOnMinor', '')::bigint, 0) > 0 then
    v_recurring_id := gen_random_uuid();
    insert into public.add_on_recurring_services(
      id, add_on_sale_id, name, monthly_amount_minor, currency, start_date,
      billing_day, billing_time, timezone, status, created_by, updated_by
    ) values (
      v_recurring_id, v_sale_id, v_add_on.name || ' mensual',
      (p_payload->>'monthlyAddOnMinor')::bigint, 'USD', (p_payload->>'monthlyStartDate')::date,
      (p_payload->>'monthlyBillingDay')::smallint,
      coalesce(nullif(p_payload->>'monthlyBillingTime', '')::time, '09:00'),
      'America/Tegucigalpa', 'active', v_actor.id, v_actor.id
    );
    perform private.generate_add_on_recurring_receivables(v_recurring_id, current_date + 45);
  end if;

  perform private.phase4_activity(
    'add_on_sale', v_sale_id, v_project.client_id, v_project.id, v_add_on.id,
    v_proposal_id, v_sale_id, 'historical_existing_module_completed',
    'Venta histórica completada sobre módulo existente',
    'El registro existente se reutilizó y se preservaron el acuerdo, la venta, el plan y sus Cobros sin enviar comunicaciones.',
    null, jsonb_build_object('effectiveDate', v_effective_date, 'amountMinor', v_amount, 'historicalImportId', v_session.id), v_actor
  );
  return jsonb_build_object('addOnId', v_add_on.id, 'proposalId', v_proposal_id, 'saleId', v_sale_id, 'planId', v_plan_id, 'reusedExisting', true);
end;
$$;

revoke all on function public.historical_add_on_complete_existing(jsonb) from public, anon;
grant execute on function public.historical_add_on_complete_existing(jsonb) to authenticated;

comment on function public.historical_add_on_complete_existing(jsonb) is
  'Owner/Admin-only, atomic completion of an unsold existing module during an active historical import; sends no communications.';
