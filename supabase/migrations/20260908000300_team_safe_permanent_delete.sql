-- Business-history based Team deletion. Authentication and auxiliary rows alone
-- do not make an otherwise unused membership permanent.

create table public.member_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  deleted_member_id uuid not null,
  deleted_member_label text not null,
  deleted_by uuid references public.profiles(id) on delete set null,
  reason text not null check(length(btrim(reason)) between 3 and 500),
  safe_metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

alter table public.member_deletion_audit enable row level security;
alter table public.member_deletion_audit force row level security;
revoke all on public.member_deletion_audit from public, anon, authenticated;
grant select, insert on public.member_deletion_audit to service_role;
create index member_deletion_audit_deleted_at_idx on public.member_deletion_audit(deleted_at desc);
create unique index member_deletion_audit_deleted_member_idx on public.member_deletion_audit(deleted_member_id);

create or replace function private.member_business_deletion_blocker(p_target uuid)
returns table(can_delete boolean, reason_code text, reason text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_count bigint;
  v_role public.crm_role;
begin
  select role into v_role from public.profiles where id=p_target;
  if not found then
    return query select false, 'not_found'::text, 'El miembro ya no existe.'::text;
    return;
  end if;
  if v_role='owner' then
    return query select false, 'protected_owner'::text, 'El Owner protegido no puede eliminarse.'::text;
    return;
  end if;

  select count(*) into v_count from public.mail_messages where sent_by=p_target;
  if v_count>0 then
    return query select false, 'mail_sent'::text,
      format('No puede eliminarse porque envió %s correo(s) desde Ken Code Mail. Puede desactivar su acceso.',v_count)::text;
    return;
  end if;
  select count(*) into v_count from public.mail_threads t
    where t.assigned_to=p_target and exists(select 1 from public.mail_messages m where m.thread_id=t.id);
  if v_count>0 then
    return query select false, 'mail_history'::text,
      format('No puede eliminarse porque tiene %s conversación(es) empresarial(es) a su cargo. Puede desactivar su acceso.',v_count)::text;
    return;
  end if;
  select count(*) into v_count from public.mail_drafts where owner_id=p_target;
  if v_count>0 then
    return query select false, 'mail_drafts'::text,
      format('No puede eliminarse porque conserva %s borrador(es) de correo. Elimine o reasigne esos borradores primero.',v_count)::text;
    return;
  end if;
  select count(*) into v_count from public.mail_follow_ups where assigned_to=p_target or created_by=p_target;
  if v_count>0 then
    return query select false, 'mail_follow_ups'::text,
      format('No puede eliminarse porque tiene %s seguimiento(s) de correo registrado(s). Puede desactivar su acceso.',v_count)::text;
    return;
  end if;

  select count(*) into v_count from public.tasks
    where created_by=p_target or completed_by=p_target
       or (assigned_to=p_target and status in ('in_progress','completed','overdue','cancelled'));
  if v_count>0 then
    return query select false, 'task_history'::text,
      format('No puede eliminarse porque tiene %s tarea(s) con actividad registrada. Puede desactivar su acceso.',v_count)::text;
    return;
  end if;
  select count(*) into v_count from public.lead_notes where author_id=p_target;
  if v_count>0 then
    return query select false, 'business_notes'::text,
      format('No puede eliminarse porque escribió %s nota(s) empresarial(es). Puede desactivar su acceso.',v_count)::text;
    return;
  end if;

  select count(*) into v_count
  from public.receivables r
  where r.created_by=p_target or r.cancelled_by=p_target;
  v_count := v_count
    + (select count(*) from public.payments where recorded_by=p_target or reversed_by=p_target)
    + (select count(*) from public.payment_allocations where created_by=p_target or reversed_by=p_target)
    + (select count(*) from public.expenses where created_by=p_target or reversed_by=p_target)
    + (select count(*) from public.expense_categories where created_by=p_target)
    + (select count(*) from public.recurring_period_exceptions where created_by=p_target);
  if v_count>0 then
    return query select false, 'financial_history'::text,
      format('No puede eliminarse porque registró %s acción(es) financiera(s). Puede desactivar su acceso.',v_count)::text;
    return;
  end if;

  select count(*) into v_count from public.clients where created_by=p_target;
  v_count := v_count
    + (select count(*) from public.projects where created_by=p_target)
    + (select count(*) from public.project_payment_plans where created_by=p_target or activated_by=p_target)
    + (select count(*) from public.project_recurring_services where created_by=p_target or updated_by=p_target)
    + (select count(*) from public.seller_assignment_events where actor_id=p_target)
    + (select count(*) from public.project_add_ons where created_by=p_target or approved_by=p_target or delivered_by=p_target or archived_by=p_target)
    + (select count(*) from public.add_on_proposals where created_by=p_target or sent_by=p_target or decided_by=p_target)
    + (select count(*) from public.add_on_sales where seller_id=p_target or approved_by=p_target)
    + (select count(*) from public.add_on_payment_plans where created_by=p_target or activated_by=p_target)
    + (select count(*) from public.add_on_recurring_services where created_by=p_target or updated_by=p_target)
    + (select count(*) from public.add_on_seller_assignment_events where actor_id=p_target)
    + (select count(*) from public.historical_import_sessions where started_by=p_target or completed_by=p_target);
  if v_count>0 then
    return query select false, 'commercial_history'::text,
      format('No puede eliminarse porque registró %s acción(es) comercial(es). Puede desactivar su acceso.',v_count)::text;
    return;
  end if;

  select count(*) into v_count from public.mail_identities where created_by=p_target;
  v_count := v_count
    + (select count(*) from public.mail_templates where created_by=p_target or updated_by=p_target)
    + (select count(*) from public.corporate_mail_signatures where created_by=p_target);
  if v_count>0 then
    return query select false, 'mail_administration_history'::text,
      format('No puede eliminarse porque creó o publicó %s configuración(es) de correo empresarial. Puede desactivar su acceso.',v_count)::text;
    return;
  end if;

  select count(*) into v_count from public.activity_logs
    where actor_id=p_target and entity_type in (
      'lead','note','task','client','project','payment_plan','recurring_service',
      'receivable','payment','billing','expense','expense_category','finance_report',
      'module','proposal','add_on_sale','add_on_payment_plan','add_on_recurring','historical_import'
    );
  if v_count>0 then
    return query select false, 'business_activity'::text,
      format('No puede eliminarse porque registró %s acción(es) empresarial(es). Puede desactivar su acceso.',v_count)::text;
    return;
  end if;

  return query select true, 'eligible'::text,
    'Este miembro no tiene actividad empresarial registrada y puede eliminarse definitivamente.'::text;
end
$$;

revoke all on function private.member_business_deletion_blocker(uuid) from public, anon, authenticated;

drop function if exists public.assess_member_permanent_deletion(uuid,uuid);
create function public.assess_member_permanent_deletion(p_target uuid,p_actor uuid)
returns table(can_delete boolean,reason_code text,reason text)
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  if auth.role()<>'service_role' then
    raise exception 'member deletion assessment requires service role' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_actor and active and role='owner') then
    raise exception 'owner authorization required' using errcode='42501';
  end if;
  if p_target=p_actor then
    return query select false,'protected_owner'::text,'El Owner protegido no puede eliminarse.'::text;
    return;
  end if;
  return query select * from private.member_business_deletion_blocker(p_target);
end
$$;
revoke all on function public.assess_member_permanent_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assess_member_permanent_deletion(uuid,uuid) to service_role;

-- These rows are access, delivery, or assignment state. Clean them inside the
-- same transaction that deletes the Auth user/profile. A final blocker check in
-- this trigger closes the assessment/delete race.
alter table public.mail_identity_assignments alter column assigned_by drop not null;
alter table public.mail_identity_assignments drop constraint mail_identity_assignments_assigned_by_fkey;
alter table public.mail_identity_assignments add constraint mail_identity_assignments_assigned_by_fkey
  foreign key(assigned_by) references public.profiles(id) on delete set null;

create or replace function private.cleanup_unused_member_dependencies()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_block record;
begin
  select * into v_block from private.member_business_deletion_blocker(old.id);
  if not coalesce(v_block.can_delete,false) then
    raise exception '%',v_block.reason using errcode='55000';
  end if;

  update public.leads set assigned_to=null,assigned_at=null,assigned_by=null where assigned_to=old.id;
  update public.clients set assigned_to=null,assigned_at=null,assigned_by=null where assigned_to=old.id;
  update public.projects set assigned_to=null,assigned_at=null,assigned_by=null where assigned_to=old.id;
  update public.project_add_ons set assigned_sales_agent_id=null where assigned_sales_agent_id=old.id;
  update public.tasks set assigned_to=null,assigned_at=null,assigned_by=null
    where assigned_to=old.id and status='pending';
  update public.mail_threads set assigned_to=null where assigned_to=old.id;

  delete from public.assignment_notification_events where recipient_id=old.id;
  delete from public.reminder_events where recipient_id=old.id;
  delete from public.notifications where recipient_id=old.id;
  update public.activity_logs set recipient_id=null where recipient_id=old.id;
  delete from public.push_logs where device_token_id in (select id from public.device_tokens where profile_id=old.id);
  delete from public.device_tokens where profile_id=old.id;
  delete from public.mail_read_states where profile_id=old.id;
  delete from public.mail_signatures where profile_id=old.id;
  delete from public.mail_identity_assignments where profile_id=old.id;
  update public.mail_identity_assignments set assigned_by=null where assigned_by=old.id;
  delete from public.user_notification_preferences where profile_id=old.id;
  delete from public.migration_id_map where target_table='profiles' and target_id=old.id::text;

  insert into public.member_deletion_audit(
    deleted_member_id,
    deleted_member_label,
    reason,
    safe_metadata
  ) values (
    old.id,
    coalesce(nullif(btrim(old.display_name),''),nullif(btrim(old.name),''),'Miembro del equipo'),
    'Cuenta sin actividad empresarial eliminada por el Owner.',
    jsonb_build_object('eligibility','eligible','accessRevoked',true)
  );
  return old;
end
$$;

drop trigger if exists profiles_cleanup_unused_member_dependencies on public.profiles;
create trigger profiles_cleanup_unused_member_dependencies
before delete on public.profiles
for each row execute function private.cleanup_unused_member_dependencies();

comment on function public.assess_member_permanent_deletion(uuid,uuid) is
  'Owner/service-only assessment based on protected business history, not authentication history.';
comment on table public.member_deletion_audit is
  'Content-minimal security tombstones for completed Team member deletions.';
