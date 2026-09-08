-- Permanent Mail deletion is based on protected business dependencies. Read,
-- archive, Trash, delivery and attachment metadata do not create retention by
-- themselves.

create table public.mail_storage_cleanup_queue (
  storage_path text primary key,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);

alter table public.mail_storage_cleanup_queue enable row level security;
alter table public.mail_storage_cleanup_queue force row level security;
revoke all on public.mail_storage_cleanup_queue from public,anon,authenticated;
grant select,insert,update,delete on public.mail_storage_cleanup_queue to service_role;

create or replace function public.assess_mail_thread_permanent_deletion(
  p_thread uuid,
  p_actor uuid
)
returns table(can_delete boolean, reason_code text, reason text, attachment_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_thread public.mail_threads%rowtype;
  v_name text;
  v_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'mail deletion assessment requires service role' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_actor and active and role='owner') then
    raise exception 'owner authorization required' using errcode='42501';
  end if;
  select * into v_thread from public.mail_threads where id=p_thread;
  if not found then return query select false,'not_found','La conversación ya no está disponible.',0; return; end if;
  select count(*)::integer into v_count from public.mail_attachments a join public.mail_messages m on m.id=a.message_id where m.thread_id=p_thread;
  if v_thread.state <> 'trash' then return query select false,'not_in_trash','Mueva la conversación a Papelera antes de eliminarla definitivamente.',v_count; return; end if;
  if v_thread.client_id is not null then
    select coalesce(nullif(company,''),name) into v_name from public.clients where id=v_thread.client_id;
    return query select false,'client','No puede eliminarse porque está vinculada al cliente '||coalesce(v_name,'registrado')||'.',v_count; return;
  end if;
  if v_thread.lead_id is not null then
    select coalesce(nullif(business,''),name) into v_name from public.leads where id=v_thread.lead_id;
    return query select false,'lead','No puede eliminarse porque forma parte del historial del prospecto '||coalesce(v_name,'registrado')||'.',v_count; return;
  end if;
  if v_thread.project_id is not null then
    select name into v_name from public.projects where id=v_thread.project_id;
    return query select false,'project','No puede eliminarse porque forma parte del proyecto '||coalesce(v_name,'registrado')||'.',v_count; return;
  end if;
  if v_thread.add_on_id is not null then
    select name into v_name from public.project_add_ons where id=v_thread.add_on_id;
    return query select false,'module','No puede eliminarse porque forma parte del módulo '||coalesce(v_name,'registrado')||'.',v_count; return;
  end if;
  if v_thread.proposal_id is not null then
    select proposal_number into v_name from public.add_on_proposals where id=v_thread.proposal_id;
    return query select false,'proposal','No puede eliminarse porque forma parte de la cotización '||coalesce(v_name,'registrada')||'.',v_count; return;
  end if;
  if exists(select 1 from public.mail_follow_ups where thread_id=p_thread and completed_at is null) then
    return query select false,'active_follow_up','Esta conversación tiene un seguimiento activo. Finalice o cancele el seguimiento antes de eliminarla definitivamente.',v_count; return;
  end if;
  if exists(select 1 from public.tasks where legacy_data->>'threadId'=p_thread::text and status not in ('completed','cancelled')) then
    return query select false,'active_task','Esta conversación tiene una tarea activa. Finalice o cancele la tarea antes de eliminarla definitivamente.',v_count; return;
  end if;
  if exists(select 1 from public.mail_drafts where thread_id=p_thread) then
    return query select false,'draft','Esta conversación tiene un borrador pendiente. Elimine o envíe el borrador antes de continuar.',v_count; return;
  end if;
  return query select true,'eligible',case when v_count>0
    then 'Esta conversación no tiene vínculos comerciales que requieran conservarse. Sus adjuntos también se eliminarán.'
    else 'Esta conversación no tiene vínculos comerciales que requieran conservarse.' end,v_count;
end
$$;

revoke all on function public.assess_mail_thread_permanent_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assess_mail_thread_permanent_deletion(uuid,uuid) to service_role;

drop function if exists public.permanently_delete_mail_thread(uuid,uuid);
create function public.permanently_delete_mail_thread(
  p_thread uuid,
  p_actor uuid,
  p_reason text
)
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_thread public.mail_threads%rowtype;
  v_assessment record;
  v_paths text[] := '{}'::text[];
  v_message_count integer := 0;
  v_attachment_count integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'mail hard delete requires service role' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'deletion reason required' using errcode='22023'; end if;
  select * into v_thread from public.mail_threads where id=p_thread for update;
  if not found then raise exception 'mail thread not found' using errcode='P0002'; end if;
  select * into v_assessment from public.assess_mail_thread_permanent_deletion(p_thread,p_actor);
  if not v_assessment.can_delete then raise exception '%',v_assessment.reason using errcode='55000'; end if;

  select coalesce(array_agg(a.storage_path order by a.storage_path),'{}'::text[]),count(*)::integer
    into v_paths,v_attachment_count
    from public.mail_attachments a join public.mail_messages m on m.id=a.message_id
    where m.thread_id=p_thread;
  select count(*)::integer into v_message_count from public.mail_messages where thread_id=p_thread;
  if cardinality(v_paths)>0 then
    insert into public.mail_storage_cleanup_queue(storage_path,requested_by)
    select unnest(v_paths),p_actor on conflict(storage_path) do update set requested_at=now(),completed_at=null,last_error=null;
  end if;

  update public.notifications set deleted_at=coalesce(deleted_at,now()),action_url=null,updated_at=now()
    where action_url in ('/admin/mail?thread='||p_thread::text,'/admin/mail?folder=inbox&thread='||p_thread::text,
      '/admin/mail?folder=sent&thread='||p_thread::text,'/admin/mail?folder=trash&thread='||p_thread::text);
  delete from public.mail_read_states where thread_id=p_thread;
  delete from public.mail_follow_ups where thread_id=p_thread;
  delete from public.mail_audit_events where thread_id=p_thread;
  delete from public.mail_attachments where message_id in (select id from public.mail_messages where thread_id=p_thread);
  perform set_config('app.mail_hard_delete','on',true);
  delete from public.mail_messages where thread_id=p_thread;
  perform set_config('app.mail_hard_delete','off',true);
  delete from public.mail_threads where id=p_thread;
  insert into public.mail_audit_events(action,actor_id,safe_metadata)
  values('mail_thread_permanently_deleted',p_actor,jsonb_build_object(
    'threadReference',p_thread::text,'messageCount',v_message_count,'attachmentCount',v_attachment_count,'reason',btrim(p_reason)
  ));
  return v_paths;
end
$$;

revoke all on function public.permanently_delete_mail_thread(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.permanently_delete_mail_thread(uuid,uuid,text) to service_role;

comment on function public.assess_mail_thread_permanent_deletion(uuid,uuid) is
  'Owner-only dependency assessment; auxiliary activity and attachment presence do not block an otherwise eligible Trash conversation.';
comment on function public.permanently_delete_mail_thread(uuid,uuid,text) is
  'Owner-only hard delete for an eligible Trash conversation with durable attachment cleanup tracking and a content-free audit tombstone.';
