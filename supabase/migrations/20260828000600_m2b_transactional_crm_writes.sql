-- M2B application readiness: authenticated, RLS-backed CRM writes remain atomic.
create or replace function public.crm_write(p_operation text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_actor public.profiles%rowtype;
  v_lead public.leads%rowtype;
  v_task public.tasks%rowtype;
  v_notification public.notifications%rowtype;
  v_assignee public.profiles%rowtype;
  v_id uuid;
  v_updates jsonb;
  v_input jsonb;
  v_assignee_id uuid;
  v_lead_id uuid;
  v_due_at timestamptz;
  v_status public.task_status;
  v_action text;
  v_count integer := 0;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid CRM mutation payload' using errcode = '22023';
  end if;

  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found then
    raise exception 'active profile required' using errcode = '42501';
  end if;

  if p_operation = 'lead_update' then
    if v_actor.role not in ('owner', 'admin', 'manager', 'sales_agent') then
      raise exception 'lead update forbidden' using errcode = '42501';
    end if;
    v_updates := coalesce(p_payload->'updates', '{}'::jsonb);
    if jsonb_typeof(v_updates) <> 'object'
       or v_updates - array['status','priority','estimatedValue','initialProjectAmount','monthlyFee','paymentStatus','billingStartDate','billingNotes','wonValue','lastContactAt','nextAction','followUpDate','followUpTime','followUpTimezone','followUpAt','tags'] <> '{}'::jsonb then
      raise exception 'unsupported lead update' using errcode = '22023';
    end if;
    select * into v_lead from public.leads where id = (p_payload->>'id')::uuid for update;
    if not found then raise exception 'lead not found' using errcode = 'P0002'; end if;
    if v_actor.role = 'sales_agent' and v_lead.assigned_to is distinct from v_actor.id then
      raise exception 'lead update forbidden' using errcode = '42501';
    end if;

    update public.leads set
      status = case when v_updates ? 'status' then (v_updates->>'status')::public.lead_status else status end,
      priority = case when v_updates ? 'priority' then (v_updates->>'priority')::public.lead_priority else priority end,
      estimated_value_minor = case when v_updates ? 'estimatedValue' then round((v_updates->>'estimatedValue')::numeric * 100)::bigint else estimated_value_minor end,
      initial_project_amount_minor = case when v_updates ? 'initialProjectAmount' then round((v_updates->>'initialProjectAmount')::numeric * 100)::bigint else initial_project_amount_minor end,
      monthly_fee_minor = case when v_updates ? 'monthlyFee' then round((v_updates->>'monthlyFee')::numeric * 100)::bigint else monthly_fee_minor end,
      payment_status = case when v_updates ? 'paymentStatus' then (v_updates->>'paymentStatus')::public.payment_status else payment_status end,
      billing_start_date = case when v_updates ? 'billingStartDate' then nullif(v_updates->>'billingStartDate','')::date else billing_start_date end,
      billing_notes = case when v_updates ? 'billingNotes' then coalesce(v_updates->>'billingNotes','') else billing_notes end,
      won_value_minor = case when v_updates ? 'wonValue' then round((v_updates->>'wonValue')::numeric * 100)::bigint else won_value_minor end,
      last_contact_at = case when v_updates ? 'lastContactAt' then nullif(v_updates->>'lastContactAt','')::timestamptz else last_contact_at end,
      next_action = case when v_updates ? 'nextAction' then coalesce(v_updates->>'nextAction','') else next_action end,
      follow_up_at = case
        when v_updates ? 'followUpAt' then nullif(v_updates->>'followUpAt','')::timestamptz
        when v_updates ?| array['followUpDate','followUpTime'] then
          ((case when v_updates?'followUpDate' then nullif(v_updates->>'followUpDate','') else follow_up_at::date::text end)||' '||
           (case when v_updates?'followUpTime' then coalesce(nullif(v_updates->>'followUpTime',''),'09:00') else coalesce(follow_up_at::time::text,'09:00') end))::timestamp at time zone 'America/Tegucigalpa'
        else follow_up_at end,
      follow_up_timezone = case when v_updates ? 'followUpTimezone' then coalesce(nullif(v_updates->>'followUpTimezone',''),'America/Tegucigalpa') else follow_up_timezone end,
      tags = case when v_updates ? 'tags' then coalesce((select array_agg(value) from jsonb_array_elements_text(v_updates->'tags')), '{}'::text[]) else tags end
    where id = v_lead.id;

    v_action := case
      when v_updates ? 'status' then 'lead_status_changed'
      when v_updates ? 'priority' then 'lead_priority_changed'
      when v_updates ?| array['nextAction','followUpAt','followUpDate','followUpTime','followUpTimezone','lastContactAt'] then 'lead_followup_updated'
      when v_updates ? 'tags' then 'lead_tags_updated'
      when v_updates ?| array['estimatedValue','initialProjectAmount','monthlyFee','paymentStatus','billingStartDate','billingNotes'] then 'lead_value_updated'
      else 'lead_updated'
    end;

    if v_updates ?| array['status','priority']
       and coalesce((select internal_notifications_enabled from public.admin_settings where id='default'), true) then
      v_id := gen_random_uuid();
      insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
      values(v_id,'supabase:'||v_id::text,coalesce(v_lead.assigned_to,v_actor.id),v_lead.assigned_to_name,coalesce(v_lead.assigned_to_email,v_actor.email),v_lead.id,
        case when v_updates ? 'status' then 'lead_status_changed' else 'lead_priority_changed' end,
        case when v_updates->>'status'='won' then 'success'::public.notification_severity when v_updates->>'status'='lost' or v_updates->>'priority'='high' then 'warning'::public.notification_severity else 'info'::public.notification_severity end,
        case when v_updates ? 'status' then 'Estado de lead actualizado' else 'Prioridad de lead actualizada' end,
        case when v_updates ? 'status' then 'El estado del lead fue actualizado.' else 'La prioridad del lead fue actualizada.' end,
        '/admin/leads/'||v_lead.id::text,false,now(),now());
    end if;

    v_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_id,'supabase:'||v_id::text,'lead',v_lead.id::text,v_lead.id,v_actor.id,v_actor.email,coalesce(v_lead.assigned_to,v_actor.id),v_action,'Lead actualizado','El lead fue actualizado de forma transaccional.',to_jsonb(v_lead),v_updates,now());
    return jsonb_build_object('id',v_lead.id);

  elsif p_operation = 'lead_assign' then
    if v_actor.role not in ('owner','admin') then raise exception 'lead assignment forbidden' using errcode='42501'; end if;
    select * into v_lead from public.leads where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'lead not found' using errcode='P0002'; end if;
    v_assignee_id := nullif(p_payload->>'assignedToUid','')::uuid;
    if v_assignee_id is not null then
      select * into v_assignee from public.profiles where id=v_assignee_id and active=true and role='sales_agent';
      if not found then raise exception 'assignee is not an active sales agent' using errcode='22023'; end if;
    else
      v_assignee.id := null; v_assignee.name := null; v_assignee.email := null;
    end if;
    if v_lead.assigned_to is not distinct from v_assignee.id then
      return jsonb_build_object('changed',false);
    end if;
    update public.leads set assigned_to=v_assignee.id,assigned_to_name=v_assignee.name,assigned_to_email=v_assignee.email,
      assigned_at=case when v_assignee.id is null then null else now() end,assigned_by=v_actor.id,assigned_by_email=v_actor.email
    where id=v_lead.id;
    v_action := case when v_assignee.id is null then 'lead_unassigned' when v_lead.assigned_to is null then 'lead_assigned' else 'lead_reassigned' end;
    if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
      if v_assignee.id is not null then
        v_id := gen_random_uuid();
        insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
        values(v_id,'supabase:'||v_id::text,v_assignee.id,v_assignee.name,v_assignee.email,v_lead.id,'lead','info',case when v_lead.assigned_to is null then 'Nuevo prospecto asignado' else 'Prospecto reasignado' end,'Un prospecto fue asignado a su cartera.','/admin/leads/'||v_lead.id::text,false,now(),now());
      end if;
      if v_lead.assigned_to is not null and v_lead.assigned_to is distinct from v_assignee.id then
        v_id := gen_random_uuid();
        insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
        values(v_id,'supabase:'||v_id::text,v_lead.assigned_to,v_lead.assigned_to_name,v_lead.assigned_to_email,v_lead.id,'lead','info',case when v_assignee.id is null then 'Asignacion retirada' else 'Prospecto reasignado' end,'La asignacion de un prospecto fue actualizada.','/admin/leads',false,now(),now());
      end if;
    end if;
    v_id := gen_random_uuid();
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(v_id,'supabase:'||v_id::text,'lead',v_lead.id::text,v_lead.id,v_actor.id,v_actor.email,v_assignee.id,v_action,'Asignacion de lead actualizada','La asignacion fue actualizada de forma transaccional.',jsonb_build_object('assignedToUid',v_lead.assigned_to),jsonb_build_object('assignedToUid',v_assignee.id),now());
    return jsonb_build_object('changed',true);

  elsif p_operation = 'note_add' then
    if v_actor.role not in ('owner','admin','sales_agent') then raise exception 'note creation forbidden' using errcode='42501'; end if;
    select * into v_lead from public.leads where id=(p_payload->>'leadId')::uuid for update;
    if not found then raise exception 'lead not found' using errcode='P0002'; end if;
    if v_actor.role='sales_agent' and v_lead.assigned_to is distinct from v_actor.id then raise exception 'note creation forbidden' using errcode='42501'; end if;
    if length(btrim(coalesce(p_payload->>'body',''))) < 2 then raise exception 'invalid note' using errcode='22023'; end if;
    v_id := gen_random_uuid();
    insert into public.lead_notes(id,firebase_id,lead_id,body,author_id,author_email,created_at)
    values(v_id,'supabase:'||v_id::text,v_lead.id,btrim(p_payload->>'body'),v_actor.id,v_actor.email,now());
    update public.leads set updated_at=now() where id=v_lead.id;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,note_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'note',v_id::text,v_lead.id,v_id,v_actor.id,v_actor.email,coalesce(v_lead.assigned_to,v_actor.id),'note_added','Nota agregada','Se agrego una nota interna.',jsonb_build_object('leadId',v_lead.id),now());
    if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
      insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
      values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,coalesce(v_lead.assigned_to,v_actor.id),v_lead.assigned_to_name,coalesce(v_lead.assigned_to_email,v_actor.email),v_lead.id,'note_added','info','Nota agregada','Se agrego una nota interna al lead.','/admin/leads/'||v_lead.id::text,false,now(),now());
    end if;
    return jsonb_build_object('id',v_id);

  elsif p_operation = 'task_create' then
    if v_actor.role not in ('owner','admin','sales_agent') then raise exception 'task creation forbidden' using errcode='42501'; end if;
    v_input := coalesce(p_payload->'input','{}'::jsonb);
    v_assignee_id := coalesce(nullif(v_input->>'assignedToUid','')::uuid,v_actor.id);
    if v_actor.role='sales_agent' and v_assignee_id is distinct from v_actor.id then raise exception 'task assignment forbidden' using errcode='42501'; end if;
    select * into v_assignee from public.profiles where id=v_assignee_id and active=true and role in ('owner','admin','sales_agent');
    if not found then raise exception 'invalid task assignee' using errcode='22023'; end if;
    v_lead_id := nullif(v_input->>'leadId','')::uuid;
    if v_lead_id is not null then
      select * into v_lead from public.leads where id=v_lead_id;
      if not found then raise exception 'lead not found' using errcode='P0002'; end if;
      if v_actor.role='sales_agent' and v_lead.assigned_to is distinct from v_actor.id then raise exception 'task lead forbidden' using errcode='42501'; end if;
      if v_assignee.role='sales_agent' and v_lead.assigned_to is distinct from v_assignee.id then raise exception 'task and lead assignee mismatch' using errcode='22023'; end if;
    end if;
    v_status := coalesce(nullif(v_input->>'status','')::public.task_status,'pending');
    v_due_at := case when nullif(v_input->>'date','') is null then null else ((v_input->>'date')||' '||coalesce(nullif(v_input->>'time',''),'09:00'))::timestamp at time zone 'America/Tegucigalpa' end;
    v_id := gen_random_uuid();
    insert into public.tasks(id,firebase_id,lead_id,title,description,type,status,priority,due_date,due_time,timezone,due_at,reminder_at,
      assigned_to,assigned_at,assigned_by,assigned_to_name,assigned_to_email,assigned_by_email,created_by,created_by_email,completed_at,completed_by,completed_by_email,created_at,updated_at)
    values(v_id,'supabase:'||v_id::text,v_lead_id,coalesce(nullif(btrim(v_input->>'title'),''),'Seguimiento'),coalesce(v_input->>'description',''),
      coalesce(nullif(v_input->>'type','')::public.task_type,'follow_up'),v_status,coalesce(nullif(v_input->>'priority','')::public.task_priority,'medium'),
      nullif(v_input->>'date','')::date,nullif(v_input->>'time','')::time,'America/Tegucigalpa',v_due_at,v_due_at,
      v_assignee.id,now(),v_actor.id,v_assignee.name,v_assignee.email,v_actor.email,v_actor.id,v_actor.email,
      case when v_status='completed' then now() else null end,case when v_status='completed' then v_actor.id else null end,case when v_status='completed' then v_actor.email else null end,now(),now());
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,task_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'task',v_id::text,v_lead_id,v_id,v_actor.id,v_actor.email,v_assignee.id,'task_created','Tarea creada','Se creo una tarea y se asigno un responsable.',jsonb_build_object('assignedToUid',v_assignee.id),now());
    if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
      insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,task_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
      values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,v_assignee.id,v_assignee.name,v_assignee.email,v_lead_id,v_id,'task_created',case when v_input->>'priority'='high' then 'warning'::public.notification_severity else 'info'::public.notification_severity end,'Nueva tarea asignada','Se asigno una nueva tarea.',case when v_lead_id is null then '/admin/tareas' else '/admin/leads/'||v_lead_id::text end,false,now(),now());
    end if;
    return jsonb_build_object('id',v_id);

  elsif p_operation = 'task_update' then
    if v_actor.role not in ('owner','admin','sales_agent') then raise exception 'task update forbidden' using errcode='42501'; end if;
    v_updates := coalesce(p_payload->'updates','{}'::jsonb);
    if jsonb_typeof(v_updates)<>'object' or v_updates-array['title','description','leadId','assignedToUid','date','time','priority','status','type']<>'{}'::jsonb then raise exception 'unsupported task update' using errcode='22023'; end if;
    select * into v_task from public.tasks where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'task not found' using errcode='P0002'; end if;
    if v_actor.role='sales_agent' and v_task.assigned_to is distinct from v_actor.id then raise exception 'task update forbidden' using errcode='42501'; end if;
    v_assignee_id := case when v_updates ? 'assignedToUid' then coalesce(nullif(v_updates->>'assignedToUid','')::uuid,v_actor.id) else v_task.assigned_to end;
    if v_actor.role='sales_agent' and v_assignee_id is distinct from v_actor.id then raise exception 'task assignment forbidden' using errcode='42501'; end if;
    select * into v_assignee from public.profiles where id=v_assignee_id and active=true and role in ('owner','admin','sales_agent');
    if not found then raise exception 'invalid task assignee' using errcode='22023'; end if;
    v_lead_id := case when v_updates ? 'leadId' then nullif(v_updates->>'leadId','')::uuid else v_task.lead_id end;
    if v_lead_id is not null then
      select * into v_lead from public.leads where id=v_lead_id;
      if not found then raise exception 'lead not found' using errcode='P0002'; end if;
      if v_actor.role='sales_agent' and v_lead.assigned_to is distinct from v_actor.id then raise exception 'task lead forbidden' using errcode='42501'; end if;
      if v_assignee.role='sales_agent' and v_lead.assigned_to is distinct from v_assignee.id then raise exception 'task and lead assignee mismatch' using errcode='22023'; end if;
    end if;
    v_status := case when v_updates ? 'status' then (v_updates->>'status')::public.task_status else v_task.status end;
    v_due_at := case when v_updates ?| array['date','time'] then ((case when v_updates ? 'date' then v_updates->>'date' else v_task.due_date::text end)||' '||(case when v_updates ? 'time' then v_updates->>'time' else coalesce(v_task.due_time::text,'09:00') end))::timestamp at time zone 'America/Tegucigalpa' else v_task.due_at end;
    update public.tasks set
      title=case when v_updates?'title' then v_updates->>'title' else title end,description=case when v_updates?'description' then coalesce(v_updates->>'description','') else description end,
      lead_id=v_lead_id,type=case when v_updates?'type' then (v_updates->>'type')::public.task_type else type end,status=v_status,priority=case when v_updates?'priority' then (v_updates->>'priority')::public.task_priority else priority end,
      due_date=case when v_updates?'date' then nullif(v_updates->>'date','')::date else due_date end,due_time=case when v_updates?'time' then nullif(v_updates->>'time','')::time else due_time end,
      due_at=v_due_at,reminder_at=v_due_at,assigned_to=v_assignee.id,assigned_to_name=v_assignee.name,assigned_to_email=v_assignee.email,
      assigned_at=case when v_assignee.id is distinct from v_task.assigned_to then now() else assigned_at end,assigned_by=case when v_assignee.id is distinct from v_task.assigned_to then v_actor.id else assigned_by end,assigned_by_email=case when v_assignee.id is distinct from v_task.assigned_to then v_actor.email else assigned_by_email end,
      completed_at=case when v_status='completed' then coalesce(v_task.completed_at,now()) else null end,completed_by=case when v_status='completed' then coalesce(v_task.completed_by,v_actor.id) else null end,completed_by_email=case when v_status='completed' then coalesce(v_task.completed_by_email,v_actor.email) else null end,
      reminder_one_day_sent_at=case when v_updates?|array['date','time'] then null else reminder_one_day_sent_at end,reminder_one_hour_sent_at=case when v_updates?|array['date','time'] then null else reminder_one_hour_sent_at end,due_notification_sent_at=case when v_updates?|array['date','time'] then null else due_notification_sent_at end,overdue_email_sent_at=case when v_updates?|array['date','time'] then null else overdue_email_sent_at end,overdue_notified_at=case when v_updates?|array['date','time'] then null else overdue_notified_at end
    where id=v_task.id;
    v_action := case when v_assignee.id is distinct from v_task.assigned_to then 'task_reassigned' when v_status='completed' and v_task.status<>'completed' then 'task_completed' when v_status='cancelled' and v_task.status<>'cancelled' then 'task_cancelled' else 'task_updated' end;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,task_id,actor_id,actor_email,recipient_id,action,title,description,before_data,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'task',v_task.id::text,v_lead_id,v_task.id,v_actor.id,v_actor.email,v_assignee.id,v_action,'Tarea actualizada','La tarea fue actualizada de forma transaccional.',to_jsonb(v_task),v_updates,now());
    if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
      v_id := gen_random_uuid();
      insert into public.notifications(id,firebase_id,recipient_id,recipient_name,recipient_email,lead_id,task_id,type,severity,title,message,action_url,is_read,created_at,updated_at)
      values(v_id,'supabase:'||v_id::text,v_assignee.id,v_assignee.name,v_assignee.email,v_lead_id,v_task.id,case when v_status='completed' then 'task_completed' else 'task_updated' end,
        case when v_status='completed' then 'success'::public.notification_severity when v_status='cancelled' then 'warning'::public.notification_severity else 'info'::public.notification_severity end,
        case when v_status='completed' then 'Tarea completada' when v_status='cancelled' then 'Tarea cancelada' else 'Tarea actualizada' end,'Una tarea asignada fue actualizada.',case when v_lead_id is null then '/admin/tareas' else '/admin/leads/'||v_lead_id::text end,false,now(),now());
    end if;
    return jsonb_build_object('id',v_task.id);

  elsif p_operation = 'task_delete' then
    if v_actor.role not in ('owner','admin') then raise exception 'task delete forbidden' using errcode='42501'; end if;
    select * into v_task from public.tasks where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'task not found' using errcode='P0002'; end if;
    delete from public.tasks where id=v_task.id;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,actor_id,actor_email,recipient_id,action,title,description,before_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'task',v_task.id::text,v_task.lead_id,v_actor.id,v_actor.email,v_task.assigned_to,'task_deleted','Tarea eliminada','La tarea fue eliminada por un administrador.',to_jsonb(v_task),now());
    return jsonb_build_object('id',v_task.id);

  elsif p_operation = 'notification_read' then
    select * into v_notification from public.notifications where id=(p_payload->>'id')::uuid and deleted_at is null for update;
    if not found then raise exception 'notification not found' using errcode='P0002'; end if;
    update public.notifications set is_read=coalesce((p_payload->>'read')::boolean,true),read_at=case when coalesce((p_payload->>'read')::boolean,true) then now() else null end where id=v_notification.id;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'notification',v_notification.id::text,v_actor.id,v_actor.email,coalesce(v_notification.recipient_id,v_actor.id),case when coalesce((p_payload->>'read')::boolean,true) then 'notification_read' else 'notification_unread' end,'Notificacion actualizada','El estado de lectura fue actualizado.',jsonb_build_object('read',coalesce((p_payload->>'read')::boolean,true)),now());
    return jsonb_build_object('id',v_notification.id);

  elsif p_operation = 'notifications_read_all' then
    update public.notifications set is_read=true,read_at=now() where deleted_at is null and is_read=false;
    get diagnostics v_count = row_count;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'notification','all',v_actor.id,v_actor.email,v_actor.id,'notifications_read_all','Notificaciones leidas','Las notificaciones accesibles fueron marcadas como leidas.',jsonb_build_object('count',v_count),now());
    return jsonb_build_object('count',v_count);

  elsif p_operation = 'notification_delete' then
    select * into v_notification from public.notifications where id=(p_payload->>'id')::uuid and deleted_at is null for update;
    if not found then raise exception 'notification not found' using errcode='P0002'; end if;
    update public.notifications set deleted_at=now() where id=v_notification.id;
    insert into public.activity_logs(id,firebase_id,entity_type,entity_id,actor_id,actor_email,recipient_id,action,title,description,after_data,created_at)
    values(gen_random_uuid(),'supabase:'||gen_random_uuid()::text,'notification',v_notification.id::text,v_actor.id,v_actor.email,coalesce(v_notification.recipient_id,v_actor.id),'notification_deleted','Notificacion eliminada','La notificacion fue archivada.',jsonb_build_object('deletedAt',true),now());
    return jsonb_build_object('id',v_notification.id);

  elsif p_operation = 'settings_update' then
    if v_actor.role not in ('owner','admin') then raise exception 'settings update forbidden' using errcode='42501'; end if;
    v_updates := coalesce(p_payload->'settings','{}'::jsonb);
    if jsonb_typeof(v_updates)<>'object' or v_updates-array['emailNotificationsEnabled','pushNotificationsEnabled','internalNotificationsEnabled','taskReminder1DayEnabled','taskReminder1HourEnabled','taskDueEnabled','taskOverdueEnabled','dailySummaryEnabled','notificationSoundEnabled','compactModeEnabled']<>'{}'::jsonb then raise exception 'unsupported settings update' using errcode='22023'; end if;
    update public.admin_settings set
      email_notifications_enabled=(v_updates->>'emailNotificationsEnabled')::boolean,push_notifications_enabled=(v_updates->>'pushNotificationsEnabled')::boolean,internal_notifications_enabled=(v_updates->>'internalNotificationsEnabled')::boolean,
      task_reminder_one_day_enabled=(v_updates->>'taskReminder1DayEnabled')::boolean,task_reminder_one_hour_enabled=(v_updates->>'taskReminder1HourEnabled')::boolean,task_due_enabled=(v_updates->>'taskDueEnabled')::boolean,task_overdue_enabled=(v_updates->>'taskOverdueEnabled')::boolean,
      daily_summary_enabled=(v_updates->>'dailySummaryEnabled')::boolean,notification_sound_enabled=(v_updates->>'notificationSoundEnabled')::boolean,compact_mode_enabled=(v_updates->>'compactModeEnabled')::boolean,updated_by=v_actor.id,updated_by_email=v_actor.email
    where id='default';
    return jsonb_build_object('id','default');
  end if;

  raise exception 'unsupported CRM mutation operation' using errcode = '22023';
end;
$$;

revoke all on function public.crm_write(text,jsonb) from public, anon;
grant execute on function public.crm_write(text,jsonb) to authenticated;

drop policy if exists notifications_insert_admin on public.notifications;
drop policy if exists notifications_insert_scoped on public.notifications;
create policy notifications_insert_scoped on public.notifications
for insert to authenticated
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role()='manager'
    and lead_id is not null
    and recipient_id in (auth.uid(), (select l.assigned_to from public.leads l where l.id=lead_id))
  )
  or (private.current_profile_role()='sales_agent' and recipient_id=auth.uid())
);

drop policy if exists activity_logs_insert_scoped on public.activity_logs;
create policy activity_logs_insert_scoped on public.activity_logs
for insert to authenticated
with check (
  private.is_operations_admin()
  or (private.current_profile_role()='manager' and actor_id=auth.uid() and lead_id is not null)
  or (
    private.current_profile_role()='sales_agent'
    and actor_id=auth.uid()
    and (recipient_id=auth.uid() or (lead_id is not null and private.lead_belongs_to_current_user(lead_id)))
  )
);

comment on function public.crm_write(text,jsonb) is 'Atomic authenticated CRM mutations; application authorization is primary and RLS remains the second barrier.';

-- Preserve append-only history while allowing the existing task-delete operation.
alter table public.notifications drop constraint notifications_task_id_fkey;
alter table public.notifications add constraint notifications_task_id_fkey foreign key (task_id) references public.tasks(id) on delete set null;
alter table public.activity_logs drop constraint activity_logs_task_id_fkey;
alter table public.activity_logs add constraint activity_logs_task_id_fkey foreign key (task_id) references public.tasks(id) on delete set null;
alter table public.email_logs drop constraint email_logs_task_id_fkey;
alter table public.email_logs add constraint email_logs_task_id_fkey foreign key (task_id) references public.tasks(id) on delete set null;
alter table public.push_logs drop constraint push_logs_task_id_fkey;
alter table public.push_logs add constraint push_logs_task_id_fkey foreign key (task_id) references public.tasks(id) on delete set null;
alter table public.reminder_events drop constraint reminder_events_task_id_fkey;
alter table public.reminder_events add constraint reminder_events_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade;

create or replace function public.delete_lead_cascade(p_lead uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  c_notes integer; c_tasks integer; c_notifications integer; c_activity integer; c_email integer; c_push integer; c_leads integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and role='owner') then
    raise exception 'maintenance operation forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.leads where id=p_lead) then raise exception 'lead not found' using errcode='P0002'; end if;
  delete from public.reminder_events where task_id in (select id from public.tasks where lead_id=p_lead);
  delete from public.email_logs where lead_id=p_lead; get diagnostics c_email=row_count;
  delete from public.push_logs where lead_id=p_lead; get diagnostics c_push=row_count;
  delete from public.notifications where lead_id=p_lead; get diagnostics c_notifications=row_count;
  delete from public.activity_logs where lead_id=p_lead; get diagnostics c_activity=row_count;
  delete from public.lead_notes where lead_id=p_lead; get diagnostics c_notes=row_count;
  delete from public.tasks where lead_id=p_lead; get diagnostics c_tasks=row_count;
  delete from public.leads where id=p_lead; get diagnostics c_leads=row_count;
  return jsonb_build_object('leads',c_leads,'notes',c_notes,'tasks',c_tasks,'notifications',c_notifications,'activityLogs',c_activity,'emailLogs',c_email,'pushLogs',c_push);
end; $$;
revoke all on function public.delete_lead_cascade(uuid) from public,anon;
grant execute on function public.delete_lead_cascade(uuid) to authenticated;

create or replace function public.cleanup_operational_data()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  c_notes integer; c_tasks integer; c_notifications integer; c_activity integer; c_email integer; c_push integer; c_leads integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and role='owner') then
    raise exception 'maintenance operation forbidden' using errcode='42501';
  end if;
  delete from public.reminder_events;
  delete from public.email_logs; get diagnostics c_email=row_count;
  delete from public.push_logs; get diagnostics c_push=row_count;
  delete from public.notifications; get diagnostics c_notifications=row_count;
  delete from public.activity_logs; get diagnostics c_activity=row_count;
  delete from public.lead_notes; get diagnostics c_notes=row_count;
  delete from public.tasks; get diagnostics c_tasks=row_count;
  delete from public.leads; get diagnostics c_leads=row_count;
  return jsonb_build_object('leads',c_leads,'notes',c_notes,'tasks',c_tasks,'notifications',c_notifications,'activityLogs',c_activity,'emailLogs',c_email,'pushLogs',c_push);
end; $$;
revoke all on function public.cleanup_operational_data() from public,anon;
grant execute on function public.cleanup_operational_data() to authenticated;

create or replace function public.create_public_lead(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid := gen_random_uuid(); v_event uuid := gen_random_uuid(); v_notification uuid;
begin
  if jsonb_typeof(p_payload)<>'object'
     or length(btrim(coalesce(p_payload->>'name',''))) not between 2 and 120
     or length(btrim(coalesce(p_payload->>'phone',''))) not between 8 and 40
     or length(btrim(coalesce(p_payload->>'message',''))) not between 3 and 2000 then
    raise exception 'invalid public lead payload' using errcode='22023';
  end if;
  insert into public.leads(id,firebase_id,name,business,email,phone,project,budget,message,locale,status,priority,source,source_path,metadata,tags,created_at,updated_at)
  values(v_id,'supabase:'||v_id::text,btrim(p_payload->>'name'),coalesce(p_payload->>'business',''),coalesce(p_payload->>'email',''),btrim(p_payload->>'phone'),coalesce(p_payload->>'project',''),coalesce(p_payload->>'budget',''),btrim(p_payload->>'message'),
    case when p_payload->>'locale'='en' then 'en' else 'es' end,'new','medium','public_website',coalesce(p_payload->>'sourcePath','/cotizar'),coalesce(p_payload->'metadata','{}'::jsonb),
    array[case when p_payload->>'locale'='en' then 'en' else 'es' end,coalesce(p_payload->>'project','')],coalesce(nullif(p_payload->>'createdAt','')::timestamptz,now()),coalesce(nullif(p_payload->>'updatedAt','')::timestamptz,now()));
  if coalesce((select internal_notifications_enabled from public.admin_settings where id='default'),true) then
    v_notification := gen_random_uuid();
    insert into public.notifications(id,firebase_id,type,severity,title,message,lead_id,action_url,is_read,created_at,updated_at)
    values(v_notification,'supabase:'||v_notification::text,'lead_new','success','Nueva solicitud recibida','Se recibio una nueva solicitud publica.',v_id,'/admin/leads/'||v_id::text,false,now(),now());
  end if;
  insert into public.activity_logs(id,firebase_id,entity_type,entity_id,lead_id,actor_firebase_uid,actor_email,action,title,description,after_data,created_at)
  values(v_event,'supabase:'||v_event::text,'lead',v_id::text,v_id,'system','system','lead_created','Lead creado','Se recibio una solicitud desde el sitio publico.',jsonb_build_object('source','public_website','notificationId',v_notification),now());
  return v_id;
end; $$;
revoke all on function public.create_public_lead(jsonb) from public,anon,authenticated;
grant execute on function public.create_public_lead(jsonb) to service_role;

create or replace function public.claim_due_reminder_events(p_now timestamptz default now(), p_limit integer default 50)
returns table(id uuid, deterministic_key text, task_id uuid, recipient_id uuid, kind public.reminder_kind, lease_token uuid)
language plpgsql security definer set search_path=pg_catalog as $$
declare v_lease uuid := gen_random_uuid();
begin
  return query
  with candidates as (
    select r.id from public.reminder_events r
    where (r.status='pending' or (r.status='failed' and coalesce(r.retry_at,p_now)<=p_now) or (r.status='processing' and r.lease_until<p_now))
    order by r.created_at
    for update skip locked
    limit greatest(1,least(p_limit,100))
  )
  update public.reminder_events r set status='processing',lease_token=v_lease,lease_until=p_now+interval '5 minutes',attempts=r.attempts+1,updated_at=p_now
  from candidates c where r.id=c.id
  returning r.id,r.deterministic_key,r.task_id,r.recipient_id,r.kind,r.lease_token;
end; $$;

create or replace function public.complete_reminder_event(
  p_id uuid,p_lease uuid,p_notification_status public.delivery_status,p_email_status public.delivery_status,p_push_status public.delivery_status,
  p_notification_error text default null,p_email_error text default null,p_push_error text default null,p_now timestamptz default now()
)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_complete boolean;
begin
  v_complete := p_notification_status in ('sent','skipped') and p_email_status in ('sent','skipped') and p_push_status in ('sent','skipped');
  update public.reminder_events set
    status=case when v_complete then 'completed'::public.reminder_event_status else 'failed'::public.reminder_event_status end,
    notification_status=p_notification_status,notification_error=left(p_notification_error,240),email_status=p_email_status,email_error=left(p_email_error,240),push_status=p_push_status,push_error=left(p_push_error,240),
    completed_at=case when v_complete then p_now else null end,retry_at=case when v_complete then null else p_now+least(interval '6 hours',interval '5 minutes'*greatest(attempts,1)) end,
    lease_token=null,lease_until=null,updated_at=p_now
  where id=p_id and status='processing' and lease_token=p_lease;
  return found;
end; $$;

revoke all on function public.claim_due_reminder_events(timestamptz,integer) from public,anon,authenticated;
revoke all on function public.complete_reminder_event(uuid,uuid,public.delivery_status,public.delivery_status,public.delivery_status,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_due_reminder_events(timestamptz,integer) to service_role;
grant execute on function public.complete_reminder_event(uuid,uuid,public.delivery_status,public.delivery_status,public.delivery_status,text,text,text,timestamptz) to service_role;
