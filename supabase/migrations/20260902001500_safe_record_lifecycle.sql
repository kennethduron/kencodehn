-- Central, capability-oriented lifecycle rules. Financial history remains immutable.

alter table public.project_add_ons
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text not null default '';

create or replace function private.record_lifecycle_exists(p_entity text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  return case p_entity
    when 'lead' then exists(select 1 from public.leads where id=p_id)
    when 'client' then exists(select 1 from public.clients where id=p_id)
    when 'project' then exists(select 1 from public.projects where id=p_id)
    when 'module' then exists(select 1 from public.project_add_ons where id=p_id)
    when 'proposal' then exists(select 1 from public.add_on_proposals where id=p_id)
    when 'task' then exists(select 1 from public.tasks where id=p_id)
    when 'recurring_service' then exists(select 1 from public.project_recurring_services where id=p_id)
    when 'add_on_recurring' then exists(select 1 from public.add_on_recurring_services where id=p_id)
    when 'mail_identity' then exists(select 1 from public.mail_identities where id=p_id)
    when 'payment' then exists(select 1 from public.payments where id=p_id)
    when 'receivable' then exists(select 1 from public.receivables where id=p_id)
    when 'expense' then exists(select 1 from public.expenses where id=p_id)
    else false end;
end; $$;

create or replace function private.record_lifecycle_has_history(p_entity text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if p_entity='lead' then return
    exists(select 1 from public.lead_notes where lead_id=p_id) or
    exists(select 1 from public.tasks where lead_id=p_id) or
    exists(select 1 from public.clients where origin_lead_id=p_id) or
    exists(select 1 from public.notifications where lead_id=p_id) or
    exists(select 1 from public.email_logs where lead_id=p_id) or
    exists(select 1 from public.push_logs where lead_id=p_id) or
    exists(select 1 from public.mail_threads where lead_id=p_id) or
    exists(select 1 from public.mail_drafts where lead_id=p_id) or
    exists(select 1 from public.activity_logs where lead_id=p_id and action not in ('lead_created','lead_received','public_lead_created'));
  elsif p_entity='client' then return
    exists(select 1 from public.clients where id=p_id and origin_lead_id is not null) or
    exists(select 1 from public.projects where client_id=p_id) or
    exists(select 1 from public.project_add_ons where client_id=p_id) or
    exists(select 1 from public.receivables where client_id=p_id) or
    exists(select 1 from public.payments where client_id=p_id) or
    exists(select 1 from public.mail_threads where client_id=p_id) or
    exists(select 1 from public.mail_drafts where client_id=p_id) or
    exists(select 1 from public.seller_assignment_events where client_id=p_id) or
    exists(select 1 from public.activity_logs where client_id=p_id and action not in ('client_created'));
  elsif p_entity='project' then return
    exists(select 1 from public.project_payment_plans where project_id=p_id) or
    exists(select 1 from public.project_recurring_services where project_id=p_id) or
    exists(select 1 from public.project_add_ons where project_id=p_id) or
    exists(select 1 from public.receivables where project_id=p_id) or
    exists(select 1 from public.mail_threads where project_id=p_id) or
    exists(select 1 from public.mail_drafts where project_id=p_id) or
    exists(select 1 from public.seller_assignment_events where project_id=p_id) or
    exists(select 1 from public.activity_logs where project_id=p_id and action not in ('project_created'));
  elsif p_entity='module' then return
    exists(select 1 from public.add_on_proposals where add_on_id=p_id and status<>'draft') or
    exists(select 1 from public.add_on_sales where add_on_id=p_id) or
    exists(select 1 from public.receivables where metadata->>'addOnId'=p_id::text) or
    exists(select 1 from public.mail_threads where add_on_id=p_id) or
    exists(select 1 from public.mail_drafts where add_on_id=p_id) or
    exists(select 1 from public.add_on_seller_assignment_events where add_on_id=p_id) or
    exists(select 1 from public.activity_logs where add_on_id=p_id and action not in ('module_created','proposal_created','proposal_updated'));
  elsif p_entity='proposal' then return
    exists(select 1 from public.add_on_sales where proposal_id=p_id) or
    exists(select 1 from public.mail_threads where proposal_id=p_id) or
    exists(select 1 from public.mail_drafts where proposal_id=p_id) or
    exists(select 1 from public.add_on_proposals where id=p_id and status<>'draft');
  elsif p_entity='task' then return
    exists(select 1 from public.tasks where id=p_id and status in ('completed','cancelled','overdue')) or
    exists(select 1 from public.notifications where task_id=p_id) or
    exists(select 1 from public.email_logs where task_id=p_id) or
    exists(select 1 from public.push_logs where task_id=p_id) or
    exists(select 1 from public.reminder_events where task_id=p_id) or
    exists(select 1 from public.activity_logs where task_id=p_id and action<>'task_created');
  elsif p_entity='recurring_service' then return exists(select 1 from public.receivables where recurring_service_id=p_id);
  elsif p_entity='add_on_recurring' then return exists(select 1 from public.receivables where add_on_recurring_service_id=p_id);
  elsif p_entity='mail_identity' then return
    exists(select 1 from public.mail_threads where identity_id=p_id) or
    exists(select 1 from public.mail_messages where sender_identity_id=p_id) or
    exists(select 1 from public.mail_drafts where identity_id=p_id);
  elsif p_entity in ('payment','receivable','expense') then return true;
  end if;
  return true;
end; $$;

create or replace function public.record_lifecycle_inspect(p_entity text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_role text; v_exists boolean; v_history boolean; v_delete boolean; v_archive boolean; v_reason text; v_recommended text;
begin
  select role::text into v_role from public.profiles where id=auth.uid() and active;
  if v_role is null then raise exception 'inactive or unauthorized user' using errcode='42501'; end if;
  if v_role not in ('owner','admin','manager') then raise exception 'lifecycle access forbidden' using errcode='42501'; end if;
  v_exists := private.record_lifecycle_exists(p_entity,p_id);
  if not v_exists then raise exception 'record not found' using errcode='P0002'; end if;
  v_history := private.record_lifecycle_has_history(p_entity,p_id);
  v_delete := not v_history and (
    v_role in ('owner','admin','manager') and p_entity in ('lead','client','project','module','proposal','task','recurring_service','add_on_recurring')
    or v_role='owner' and p_entity='mail_identity'
  );
  v_archive := (
    v_role in ('owner','admin','manager') and p_entity in ('lead','client','project','module','proposal','task','recurring_service','add_on_recurring')
  ) or (v_role='owner' and p_entity='mail_identity');
  if p_entity in ('payment','receivable','expense') then
    v_delete:=false; v_archive:=false; v_recommended:=case p_entity when 'payment' then 'reverse' when 'receivable' then 'cancel' else 'reverse' end;
    v_reason:='Este movimiento financiero debe conservarse. Use la acción financiera auditable correspondiente.';
  elsif v_delete then v_recommended:='delete'; v_reason:='Este registro no tiene actividad empresarial relacionada y puede eliminarse definitivamente.';
  elsif v_history then v_recommended:=case when p_entity in ('client','recurring_service','add_on_recurring','mail_identity') then 'deactivate' when p_entity in ('project','proposal','task') then 'cancel' else 'archive' end;
    v_reason:='Este registro tiene actividad y debe conservarse para mantener el historial de Ken Code.';
  else v_recommended:='none'; v_reason:='Su rol no permite una acción destructiva sobre este registro.'; end if;
  return jsonb_build_object('entity',p_entity,'id',p_id,'exists',true,'hasHistory',v_history,'deleteAllowed',v_delete,'archiveAllowed',v_archive,'recommendedAction',v_recommended,'reason',v_reason,'role',v_role);
end; $$;

create or replace function public.record_lifecycle_apply(p_entity text, p_id uuid, p_action text, p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor public.profiles%rowtype; v_info jsonb; v_name text; v_event uuid:=gen_random_uuid();
begin
  select * into v_actor from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'inactive or unauthorized user' using errcode='42501'; end if;
  if p_action not in ('delete','archive','deactivate','cancel') then raise exception 'unsupported lifecycle action' using errcode='22023'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'reason required' using errcode='22023'; end if;
  v_info:=public.record_lifecycle_inspect(p_entity,p_id);
  if p_action='delete' and not (v_info->>'deleteAllowed')::boolean then raise exception '%',v_info->>'reason' using errcode='55000'; end if;
  if p_action<>'delete' and not (v_info->>'archiveAllowed')::boolean then raise exception '%',v_info->>'reason' using errcode='42501'; end if;
  if p_action is distinct from v_info->>'recommendedAction' then raise exception 'action does not match safe lifecycle recommendation' using errcode='55000'; end if;

  if p_action='delete' then
    if p_entity='lead' then update public.activity_logs set lead_id=null where lead_id=p_id; delete from public.leads where id=p_id returning name into v_name;
    elsif p_entity='client' then update public.activity_logs set client_id=null where client_id=p_id; delete from public.clients where id=p_id returning coalesce(nullif(company,''),name) into v_name;
    elsif p_entity='project' then update public.activity_logs set project_id=null where project_id=p_id; delete from public.projects where id=p_id returning name into v_name;
    elsif p_entity='module' then
      update public.activity_logs set add_on_proposal_id=null where add_on_proposal_id in (select id from public.add_on_proposals where add_on_id=p_id and status='draft');
      delete from public.add_on_proposals where add_on_id=p_id and status='draft';
      update public.activity_logs set add_on_id=null where add_on_id=p_id;
      delete from public.project_add_ons where id=p_id returning name into v_name;
    elsif p_entity='proposal' then update public.activity_logs set add_on_proposal_id=null where add_on_proposal_id=p_id; delete from public.add_on_proposals where id=p_id returning title into v_name;
    elsif p_entity='task' then update public.activity_logs set task_id=null where task_id=p_id; delete from public.tasks where id=p_id returning title into v_name;
    elsif p_entity='recurring_service' then delete from public.project_recurring_services where id=p_id returning name into v_name;
    elsif p_entity='add_on_recurring' then delete from public.add_on_recurring_services where id=p_id returning name into v_name;
    elsif p_entity='mail_identity' then
      update public.mail_audit_events set identity_id=null where identity_id=p_id;
      delete from public.mail_signatures where identity_id=p_id;
      delete from public.mail_identity_assignments where identity_id=p_id;
      delete from public.mail_identities where id=p_id returning display_name into v_name;
    else raise exception 'hard delete unavailable for this record' using errcode='42501'; end if;
  else
    if p_entity='lead' then update public.leads set status='lost',metadata=metadata||jsonb_build_object('archivedAt',now(),'archivedBy',v_actor.id,'archiveReason',btrim(p_reason)),updated_at=now() where id=p_id returning name into v_name;
    elsif p_entity='client' then update public.clients set status='inactive',metadata=metadata||jsonb_build_object('deactivatedAt',now(),'deactivatedBy',v_actor.id,'reason',btrim(p_reason)),updated_at=now() where id=p_id returning coalesce(nullif(company,''),name) into v_name;
    elsif p_entity='project' then update public.projects set status='cancelled',metadata=metadata||jsonb_build_object('cancelledAt',now(),'cancelledBy',v_actor.id,'reason',btrim(p_reason)),updated_at=now() where id=p_id returning name into v_name;
    elsif p_entity='module' then update public.project_add_ons set archived_at=now(),archived_by=v_actor.id,archive_reason=btrim(p_reason),updated_at=now() where id=p_id returning name into v_name;
    elsif p_entity='proposal' then update public.add_on_proposals set status='cancelled',updated_at=now() where id=p_id and status in ('draft','sent') returning title into v_name;
    elsif p_entity='task' then update public.tasks set status='cancelled',updated_at=now() where id=p_id returning title into v_name;
    elsif p_entity='recurring_service' then update public.project_recurring_services set status='cancelled',updated_at=now() where id=p_id returning name into v_name;
    elsif p_entity='add_on_recurring' then update public.add_on_recurring_services set status='cancelled',updated_at=now() where id=p_id returning name into v_name;
    elsif p_entity='mail_identity' then update public.mail_identities set status='inactive',updated_at=now() where id=p_id returning display_name into v_name;
    else raise exception 'lifecycle action unavailable for this record' using errcode='42501'; end if;
    if v_name is null then raise exception 'record state does not allow this action' using errcode='55000'; end if;
  end if;

  insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,action,title,description,metadata,created_at)
  values(v_event,'supabase:'||v_event::text,'system',p_id::text,v_actor.id,v_actor.email,'record_'||p_action,
    case p_action when 'delete' then 'Registro eliminado de forma segura' else 'Ciclo de vida actualizado' end,
    coalesce(v_name,'Registro')||' · '||btrim(p_reason),jsonb_build_object('entity',p_entity,'action',p_action),now());
  return jsonb_build_object('id',p_id,'entity',p_entity,'action',p_action,'name',v_name);
end; $$;

revoke all on function private.record_lifecycle_exists(text,uuid), private.record_lifecycle_has_history(text,uuid) from public, anon, authenticated;
revoke all on function public.record_lifecycle_inspect(text,uuid), public.record_lifecycle_apply(text,uuid,text,text) from public, anon;
grant execute on function public.record_lifecycle_inspect(text,uuid), public.record_lifecycle_apply(text,uuid,text,text) to authenticated;

-- Retire the legacy broad cleanup surface from browser-authenticated roles.
revoke execute on function public.delete_lead_cascade(uuid), public.cleanup_operational_data() from authenticated;
grant execute on function public.delete_lead_cascade(uuid), public.cleanup_operational_data() to service_role;

comment on function public.record_lifecycle_apply(text,uuid,text,text) is
  'Capability-checked lifecycle action: empty operational records may be deleted; records with history are preserved through archive/deactivate/cancel states.';
