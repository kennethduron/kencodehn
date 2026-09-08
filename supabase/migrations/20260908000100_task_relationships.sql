-- Task relationships may point to one Client or one Prospect while the
-- responsible employee remains an independent assignment.

drop policy if exists tasks_read_scoped on public.tasks;
drop policy if exists tasks_insert_scoped on public.tasks;
drop policy if exists tasks_update_scoped on public.tasks;
drop function if exists private.task_in_current_scope(uuid, uuid);

create function private.task_in_current_scope(
  p_assigned_to uuid,
  p_lead_id uuid,
  p_client_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p_assigned_to = auth.uid()
    and (p_lead_id is null or private.lead_belongs_to_current_user(p_lead_id))
    and (p_client_id is null or private.client_in_current_scope(p_client_id))
$$;

grant execute on function private.task_in_current_scope(uuid, uuid, uuid) to authenticated;

create policy tasks_read_scoped on public.tasks
for select to authenticated
using (
  private.current_profile_role() in ('owner','admin','manager')
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id, client_id)
  )
);

create policy tasks_insert_scoped on public.tasks
for insert to authenticated
with check (
  private.current_profile_role() in ('owner','admin','manager')
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id, client_id)
    and created_by = auth.uid()
  )
);

create policy tasks_update_scoped on public.tasks
for update to authenticated
using (
  private.current_profile_role() in ('owner','admin','manager')
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id, client_id)
  )
)
with check (
  private.current_profile_role() in ('owner','admin','manager')
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id, client_id)
  )
);

drop policy if exists notifications_insert_scoped on public.notifications;
create policy notifications_insert_scoped on public.notifications
for insert to authenticated
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role()='manager'
    and recipient_id in (
      auth.uid(),
      (select l.assigned_to from public.leads l where l.id=lead_id),
      (select t.assigned_to from public.tasks t where t.id=task_id)
    )
  )
  or (private.current_profile_role()='sales_agent' and recipient_id=auth.uid())
);

drop policy if exists activity_logs_insert_scoped on public.activity_logs;
create policy activity_logs_insert_scoped on public.activity_logs
for insert to authenticated
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role()='manager'
    and actor_id=auth.uid()
    and (lead_id is not null or client_id is not null or task_id is not null)
  )
  or (
    private.current_profile_role()='sales_agent'
    and actor_id=auth.uid()
    and (
      recipient_id=auth.uid()
      or (lead_id is not null and private.lead_belongs_to_current_user(lead_id))
      or (client_id is not null and private.client_in_current_scope(client_id))
    )
  )
);

create or replace function public.task_write_v2(
  p_operation text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_assignee public.profiles%rowtype;
  v_task public.tasks%rowtype;
  v_lead public.leads%rowtype;
  v_client public.clients%rowtype;
  v_input jsonb;
  v_updates jsonb;
  v_assignee_id uuid;
  v_relation_type text;
  v_relation_id uuid;
  v_lead_id uuid;
  v_client_id uuid;
  v_due_at timestamptz;
  v_status public.task_status;
  v_action text;
  v_id uuid;
  v_action_url text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid task mutation payload' using errcode = '22023';
  end if;
  select * into v_actor from public.profiles where id = auth.uid() and active;
  if not found or v_actor.role not in ('owner','admin','manager','sales_agent') then
    raise exception 'task mutation forbidden' using errcode = '42501';
  end if;

  if p_operation = 'task_create' then
    v_input := coalesce(p_payload->'input', '{}'::jsonb);
    if jsonb_typeof(v_input) <> 'object'
       or v_input - array['title','description','relationType','relationId','leadId','assignedToUid','date','time','priority','status','type'] <> '{}'::jsonb then
      raise exception 'unsupported task input' using errcode = '22023';
    end if;
    v_assignee_id := coalesce(nullif(v_input->>'assignedToUid','')::uuid, v_actor.id);
    if v_actor.role = 'sales_agent' and v_assignee_id is distinct from v_actor.id then
      raise exception 'task assignment forbidden' using errcode = '42501';
    end if;
    select * into v_assignee from public.profiles
      where id = v_assignee_id and active and role in ('owner','admin','sales_agent');
    if not found then raise exception 'invalid task assignee' using errcode = '22023'; end if;

    v_relation_type := nullif(v_input->>'relationType','');
    v_relation_id := nullif(v_input->>'relationId','')::uuid;
    if v_relation_type is null and nullif(v_input->>'leadId','') is not null then
      v_relation_type := 'lead';
      v_relation_id := (v_input->>'leadId')::uuid;
    end if;
    if (v_relation_type is null) <> (v_relation_id is null)
       or (v_relation_type is not null and v_relation_type not in ('lead','client')) then
      raise exception 'invalid task relationship' using errcode = '22023';
    end if;
    if v_relation_type = 'lead' then
      select * into v_lead from public.leads where id = v_relation_id;
      if not found then raise exception 'lead not found' using errcode = 'P0002'; end if;
      if v_actor.role = 'sales_agent' and v_lead.assigned_to is distinct from v_actor.id then
        raise exception 'task lead forbidden' using errcode = '42501';
      end if;
      if v_assignee.role = 'sales_agent' and v_lead.assigned_to is distinct from v_assignee.id then
        raise exception 'task and lead assignee mismatch' using errcode = '22023';
      end if;
      v_lead_id := v_relation_id;
    elsif v_relation_type = 'client' then
      select * into v_client from public.clients where id = v_relation_id;
      if not found then raise exception 'client not found' using errcode = 'P0002'; end if;
      if v_actor.role = 'sales_agent' and v_client.assigned_to is distinct from v_actor.id then
        raise exception 'task client forbidden' using errcode = '42501';
      end if;
      if v_assignee.role = 'sales_agent' and v_client.assigned_to is distinct from v_assignee.id then
        raise exception 'task and client assignee mismatch' using errcode = '22023';
      end if;
      v_client_id := v_relation_id;
    end if;

    v_status := coalesce(nullif(v_input->>'status','')::public.task_status, 'pending');
    v_due_at := case when nullif(v_input->>'date','') is null then null else
      ((v_input->>'date') || ' ' || coalesce(nullif(v_input->>'time',''), '09:00'))::timestamp at time zone 'America/Tegucigalpa' end;
    v_id := gen_random_uuid();
    insert into public.tasks(
      id,firebase_id,lead_id,client_id,title,description,type,status,priority,due_date,due_time,timezone,due_at,reminder_at,
      assigned_to,assigned_at,assigned_by,assigned_to_name,assigned_to_email,assigned_by_email,created_by,created_by_email,
      completed_at,completed_by,completed_by_email,created_at,updated_at
    ) values (
      v_id,'supabase:'||v_id::text,v_lead_id,v_client_id,coalesce(nullif(btrim(v_input->>'title'),''),'Seguimiento'),coalesce(v_input->>'description',''),
      coalesce(nullif(v_input->>'type','')::public.task_type,'follow_up'),v_status,coalesce(nullif(v_input->>'priority','')::public.task_priority,'medium'),
      nullif(v_input->>'date','')::date,nullif(v_input->>'time','')::time,'America/Tegucigalpa',v_due_at,v_due_at,
      v_assignee.id,now(),v_actor.id,v_assignee.name,v_assignee.email,v_actor.email,v_actor.id,v_actor.email,
      case when v_status='completed' then now() else null end,case when v_status='completed' then v_actor.id else null end,
      case when v_status='completed' then v_actor.email else null end,now(),now()
    );
    v_action_url := case when v_client_id is not null then '/admin/clientes/'||v_client_id::text
      when v_lead_id is not null then '/admin/leads/'||v_lead_id::text else '/admin/tareas' end;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,client_id,task_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'task',v_id::text,v_lead_id,v_client_id,v_id,v_actor.id,v_actor.email,v_assignee.id,
      'task_created','Tarea creada','Se creó una tarea y se asignó un responsable.',jsonb_build_object('assignedToUid',v_assignee.id,'relationType',v_relation_type),now());
    if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
      insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,task_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
      values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,v_assignee.id,v_assignee.name,v_assignee.email,v_lead_id,v_id,'task_created',
        case when v_input->>'priority'='high' then 'warning'::public.notification_severity else 'info'::public.notification_severity end,
        'Nueva tarea asignada','Se asignó una nueva tarea.',v_action_url,false,now(),now());
    end if;
    return jsonb_build_object('id',v_id);
  end if;

  if p_operation = 'task_update' then
    v_updates := coalesce(p_payload->'updates','{}'::jsonb);
    if jsonb_typeof(v_updates) <> 'object'
       or v_updates - array['title','description','relationType','relationId','leadId','assignedToUid','date','time','priority','status','type'] <> '{}'::jsonb then
      raise exception 'unsupported task update' using errcode = '22023';
    end if;
    select * into v_task from public.tasks where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'task not found' using errcode='P0002'; end if;
    if v_actor.role='sales_agent' and v_task.assigned_to is distinct from v_actor.id then
      raise exception 'task update forbidden' using errcode='42501';
    end if;
    v_assignee_id := case when v_updates ? 'assignedToUid' then coalesce(nullif(v_updates->>'assignedToUid','')::uuid,v_actor.id) else v_task.assigned_to end;
    if v_actor.role='sales_agent' and v_assignee_id is distinct from v_actor.id then raise exception 'task assignment forbidden' using errcode='42501'; end if;
    select * into v_assignee from public.profiles where id=v_assignee_id and active and role in ('owner','admin','sales_agent');
    if not found then raise exception 'invalid task assignee' using errcode='22023'; end if;

    if v_updates ? 'relationType' or v_updates ? 'relationId' or v_updates ? 'leadId' then
      v_relation_type := nullif(v_updates->>'relationType','');
      v_relation_id := nullif(v_updates->>'relationId','')::uuid;
      if not (v_updates ? 'relationType') and v_updates ? 'leadId' then
        v_relation_type := case when nullif(v_updates->>'leadId','') is null then null else 'lead' end;
        v_relation_id := nullif(v_updates->>'leadId','')::uuid;
      end if;
    else
      v_relation_type := case when v_task.client_id is not null then 'client' when v_task.lead_id is not null then 'lead' else null end;
      v_relation_id := coalesce(v_task.client_id,v_task.lead_id);
    end if;
    if (v_relation_type is null) <> (v_relation_id is null)
       or (v_relation_type is not null and v_relation_type not in ('lead','client')) then
      raise exception 'invalid task relationship' using errcode='22023';
    end if;
    if v_relation_type='lead' then
      select * into v_lead from public.leads where id=v_relation_id;
      if not found then raise exception 'lead not found' using errcode='P0002'; end if;
      if v_actor.role='sales_agent' and v_lead.assigned_to is distinct from v_actor.id then raise exception 'task lead forbidden' using errcode='42501'; end if;
      if v_assignee.role='sales_agent' and v_lead.assigned_to is distinct from v_assignee.id then raise exception 'task and lead assignee mismatch' using errcode='22023'; end if;
      v_lead_id:=v_relation_id; v_client_id:=null;
    elsif v_relation_type='client' then
      select * into v_client from public.clients where id=v_relation_id;
      if not found then raise exception 'client not found' using errcode='P0002'; end if;
      if v_actor.role='sales_agent' and v_client.assigned_to is distinct from v_actor.id then raise exception 'task client forbidden' using errcode='42501'; end if;
      if v_assignee.role='sales_agent' and v_client.assigned_to is distinct from v_assignee.id then raise exception 'task and client assignee mismatch' using errcode='22023'; end if;
      v_client_id:=v_relation_id; v_lead_id:=null;
    else
      v_client_id:=null; v_lead_id:=null;
    end if;
    v_status := case when v_updates ? 'status' then (v_updates->>'status')::public.task_status else v_task.status end;
    v_due_at := case when v_updates ?| array['date','time'] then
      ((case when v_updates?'date' then v_updates->>'date' else v_task.due_date::text end)||' '||
       (case when v_updates?'time' then v_updates->>'time' else coalesce(v_task.due_time::text,'09:00') end))::timestamp at time zone 'America/Tegucigalpa'
      else v_task.due_at end;
    update public.tasks set
      title=case when v_updates?'title' then v_updates->>'title' else title end,
      description=case when v_updates?'description' then coalesce(v_updates->>'description','') else description end,
      lead_id=v_lead_id,client_id=v_client_id,
      type=case when v_updates?'type' then (v_updates->>'type')::public.task_type else type end,
      status=v_status,priority=case when v_updates?'priority' then (v_updates->>'priority')::public.task_priority else priority end,
      due_date=case when v_updates?'date' then nullif(v_updates->>'date','')::date else due_date end,
      due_time=case when v_updates?'time' then nullif(v_updates->>'time','')::time else due_time end,
      due_at=v_due_at,reminder_at=v_due_at,assigned_to=v_assignee.id,assigned_to_name=v_assignee.name,assigned_to_email=v_assignee.email,
      assigned_at=case when v_assignee.id is distinct from v_task.assigned_to then now() else assigned_at end,
      assigned_by=case when v_assignee.id is distinct from v_task.assigned_to then v_actor.id else assigned_by end,
      assigned_by_email=case when v_assignee.id is distinct from v_task.assigned_to then v_actor.email else assigned_by_email end,
      completed_at=case when v_status='completed' then coalesce(v_task.completed_at,now()) else null end,
      completed_by=case when v_status='completed' then coalesce(v_task.completed_by,v_actor.id) else null end,
      completed_by_email=case when v_status='completed' then coalesce(v_task.completed_by_email,v_actor.email) else null end,
      reminder_one_day_sent_at=case when v_updates?|array['date','time'] then null else reminder_one_day_sent_at end,
      reminder_one_hour_sent_at=case when v_updates?|array['date','time'] then null else reminder_one_hour_sent_at end,
      due_notification_sent_at=case when v_updates?|array['date','time'] then null else due_notification_sent_at end,
      overdue_email_sent_at=case when v_updates?|array['date','time'] then null else overdue_email_sent_at end,
      overdue_notified_at=case when v_updates?|array['date','time'] then null else overdue_notified_at end
    where id=v_task.id;
    v_action := case when v_assignee.id is distinct from v_task.assigned_to then 'task_reassigned'
      when v_status='completed' and v_task.status<>'completed' then 'task_completed'
      when v_status='cancelled' and v_task.status<>'cancelled' then 'task_cancelled' else 'task_updated' end;
    v_action_url := case when v_client_id is not null then '/admin/clientes/'||v_client_id::text
      when v_lead_id is not null then '/admin/leads/'||v_lead_id::text else '/admin/tareas' end;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,client_id,task_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'task',v_task.id::text,v_lead_id,v_client_id,v_task.id,v_actor.id,v_actor.email,v_assignee.id,
      v_action,'Tarea actualizada','La tarea fue actualizada de forma transaccional.',to_jsonb(v_task),v_updates,now());
    if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
      insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,task_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
      values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,v_assignee.id,v_assignee.name,v_assignee.email,v_lead_id,v_task.id,
        case when v_status='completed' then 'task_completed' else 'task_updated' end,
        case when v_status='completed' then 'success'::public.notification_severity when v_status='cancelled' then 'warning'::public.notification_severity else 'info'::public.notification_severity end,
        case when v_status='completed' then 'Tarea completada' when v_status='cancelled' then 'Tarea cancelada' else 'Tarea actualizada' end,
        'Una tarea asignada fue actualizada.',v_action_url,false,now(),now());
    end if;
    return jsonb_build_object('id',v_task.id);
  end if;

  raise exception 'unsupported task mutation operation' using errcode='22023';
end
$$;

revoke all on function public.task_write_v2(text,jsonb) from public,anon;
grant execute on function public.task_write_v2(text,jsonb) to authenticated;

comment on function public.task_write_v2(text,jsonb) is
  'Creates and updates one Task with an optional Client or Prospect relationship independent from its responsible employee.';
