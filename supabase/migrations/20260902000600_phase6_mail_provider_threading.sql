-- Resend assigns the authoritative Message-ID. Keep client request idempotency
-- separate, and permit only the service role to reconcile a verified reply.
alter table public.mail_messages add column client_request_id uuid;

create or replace function private.prevent_mail_message_mutation()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and auth.role() = 'service_role'
     and (to_jsonb(new) - array['delivery_status','delivery_status_at','provider_event_id'])
       = (to_jsonb(old) - array['delivery_status','delivery_status_at','provider_event_id']) then
    return new;
  end if;
  if current_setting('app.mail_reconciliation', true) = 'on'
     and current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  raise exception 'delivered messages are immutable' using errcode='42501';
end
$$;

select set_config('app.mail_reconciliation', 'on', true);
update public.mail_messages
   set client_request_id = substring(message_id from '^<([0-9a-fA-F-]{36})@mail\.kencodehn\.com>$')::uuid
 where direction = 'outbound'
   and message_id ~ '^<[0-9a-fA-F-]{36}@mail\.kencodehn\.com>$';
select set_config('app.mail_reconciliation', 'off', true);

create unique index mail_messages_client_request_uq
  on public.mail_messages(client_request_id)
  where client_request_id is not null;

create or replace function public.reconcile_mail_threading(
  p_provider_email_id text,
  p_official_message_id text,
  p_inbound_message_id uuid default null
)
returns table(target_thread_id uuid, moved boolean)
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_outbound public.mail_messages%rowtype;
  v_inbound public.mail_messages%rowtype;
  v_source_thread uuid;
  v_target_identity uuid;
  v_source_identity uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'mail reconciliation requires service role' using errcode='42501';
  end if;
  if p_official_message_id is null
     or length(p_official_message_id) not between 3 and 998
     or p_official_message_id !~ '^<[^<>[:space:]]+>$'
     or p_official_message_id ~ E'[\r\n]' then
    raise exception 'invalid provider message id' using errcode='22023';
  end if;

  select * into v_outbound
    from public.mail_messages
   where provider_email_id = p_provider_email_id and direction = 'outbound'
   for update;
  if not found then return; end if;
  if exists(select 1 from public.mail_messages where message_id = p_official_message_id and id <> v_outbound.id) then
    raise exception 'provider message id already belongs to another message' using errcode='23505';
  end if;

  perform set_config('app.mail_reconciliation', 'on', true);
  update public.mail_messages set message_id = p_official_message_id where id = v_outbound.id;
  target_thread_id := v_outbound.thread_id;
  moved := false;
  if p_inbound_message_id is null then return next; return; end if;

  select * into v_inbound
    from public.mail_messages
   where id = p_inbound_message_id and direction = 'inbound'
   for update;
  if not found then raise exception 'inbound message not found' using errcode='P0002'; end if;
  if v_inbound.in_reply_to is distinct from p_official_message_id
     and not (p_official_message_id = any(v_inbound.reference_ids)) then
    raise exception 'inbound message does not reference provider message id' using errcode='22023';
  end if;
  if v_inbound.thread_id = v_outbound.thread_id then return next; return; end if;

  select identity_id into v_target_identity from public.mail_threads where id = v_outbound.thread_id;
  select identity_id into v_source_identity from public.mail_threads where id = v_inbound.thread_id;
  if v_target_identity is distinct from v_source_identity then
    raise exception 'cannot reconcile across mail identities' using errcode='42501';
  end if;
  v_source_thread := v_inbound.thread_id;

  update public.mail_messages set thread_id = v_outbound.thread_id where id = v_inbound.id;
  update public.mail_drafts set thread_id = v_outbound.thread_id where thread_id = v_source_thread;
  update public.mail_follow_ups set thread_id = v_outbound.thread_id where thread_id = v_source_thread;
  update public.mail_audit_events set thread_id = v_outbound.thread_id where thread_id = v_source_thread;
  update public.notifications
     set action_url = case action_url
       when '/admin/mail?thread=' || v_source_thread::text then '/admin/mail?thread=' || v_outbound.thread_id::text
       when '/admin/mail?folder=inbox&thread=' || v_source_thread::text then '/admin/mail?folder=inbox&thread=' || v_outbound.thread_id::text
       else action_url end,
         updated_at = now()
   where action_url in (
     '/admin/mail?thread=' || v_source_thread::text,
     '/admin/mail?folder=inbox&thread=' || v_source_thread::text
   );

  insert into public.mail_read_states(thread_id, profile_id, last_read_at, unread)
  select v_outbound.thread_id, profile_id, last_read_at, unread
    from public.mail_read_states where thread_id = v_source_thread
  on conflict(thread_id,profile_id) do update
    set last_read_at = greatest(public.mail_read_states.last_read_at, excluded.last_read_at),
        unread = public.mail_read_states.unread or excluded.unread;
  delete from public.mail_read_states where thread_id = v_source_thread;

  update public.mail_threads
     set state = 'inbox',
         latest_message_at = greatest(latest_message_at, coalesce(v_inbound.received_at, v_inbound.created_at)),
         updated_at = now()
   where id = v_outbound.thread_id;
  delete from public.mail_threads t
   where t.id = v_source_thread
     and not exists(select 1 from public.mail_messages m where m.thread_id=t.id)
     and not exists(select 1 from public.mail_drafts d where d.thread_id=t.id)
     and not exists(select 1 from public.mail_follow_ups f where f.thread_id=t.id)
     and not exists(select 1 from public.mail_audit_events a where a.thread_id=t.id);

  insert into public.mail_audit_events(action, identity_id, thread_id, message_id, safe_metadata)
  values('mail_thread_reconciled', v_target_identity, v_outbound.thread_id, v_inbound.id, jsonb_build_object('provider','resend'));
  moved := true;
  return next;
end
$$;

revoke all on function public.reconcile_mail_threading(text,text,uuid) from public, anon, authenticated;
grant execute on function public.reconcile_mail_threading(text,text,uuid) to service_role;

update public.mail_webhook_events e
   set status = 'failed', processed_at = null, error_category = 'thread_reconciliation_pending'
 where e.event_type = 'email.received'
   and e.status = 'processed'
   and exists (
     select 1 from public.mail_messages inbound
      where inbound.provider_event_id = e.provider_event_id
        and inbound.direction = 'inbound'
        and (inbound.in_reply_to is not null or cardinality(inbound.reference_ids) > 0)
        and not exists (
          select 1 from public.mail_messages parent
           where parent.message_id = inbound.in_reply_to
              or parent.message_id = any(inbound.reference_ids)
        )
   );

comment on function public.reconcile_mail_threading(text,text,uuid) is
  'Service-role-only reconciliation using the authoritative Resend Message-ID; never merges by subject.';
