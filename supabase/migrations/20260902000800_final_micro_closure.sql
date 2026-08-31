-- Final owner micro-closure: reliable Sent indexing, recoverable Trash with a
-- narrowly-scoped permanent delete, and proof-based deletion of unused members.

alter table public.mail_threads
  add column if not exists last_outbound_at timestamptz;

update public.mail_threads t
set last_outbound_at = source.last_outbound_at
from (
  select thread_id, max(coalesce(sent_at, created_at)) as last_outbound_at
  from public.mail_messages
  where direction = 'outbound'
  group by thread_id
) source
where source.thread_id = t.id
  and t.last_outbound_at is distinct from source.last_outbound_at;

create index if not exists mail_threads_sent_idx
  on public.mail_threads(last_outbound_at desc, id)
  where last_outbound_at is not null and state <> 'trash';

create or replace function private.refresh_mail_thread_outbound_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.direction = 'outbound' then
    update public.mail_threads
       set last_outbound_at = greatest(
         coalesce(last_outbound_at, '-infinity'::timestamptz),
         coalesce(new.sent_at, new.created_at)
       )
     where id = new.thread_id;
  end if;
  return new;
end
$$;

drop trigger if exists mail_messages_refresh_outbound_at on public.mail_messages;
create trigger mail_messages_refresh_outbound_at
after insert on public.mail_messages
for each row execute function private.refresh_mail_thread_outbound_at();

create or replace function private.prevent_mail_message_mutation()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('app.mail_hard_delete', true) = 'on'
     and current_user in ('postgres', 'supabase_admin') then
    return old;
  end if;
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

create or replace function public.permanently_delete_mail_thread(
  p_thread uuid,
  p_actor uuid
)
returns text[]
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_thread public.mail_threads%rowtype;
  v_paths text[] := '{}'::text[];
  v_message_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'mail hard delete requires service role' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor and active and role = 'owner'
  ) then
    raise exception 'owner authorization required' using errcode='42501';
  end if;

  select * into v_thread from public.mail_threads where id = p_thread for update;
  if v_thread.id is null then
    raise exception 'mail thread not found' using errcode='P0002';
  end if;
  if v_thread.state <> 'trash' then
    raise exception 'mail thread must be in trash' using errcode='22023';
  end if;
  if v_thread.lead_id is not null or v_thread.client_id is not null
     or v_thread.project_id is not null or v_thread.add_on_id is not null
     or v_thread.proposal_id is not null then
    raise exception 'linked business mail must be retained' using errcode='55000';
  end if;
  if exists(select 1 from public.mail_drafts where thread_id = p_thread)
     or exists(select 1 from public.mail_follow_ups where thread_id = p_thread) then
    raise exception 'mail with pending work must be retained' using errcode='55000';
  end if;
  if exists(
    select 1 from public.mail_attachments a
    join public.mail_messages m on m.id = a.message_id
    where m.thread_id = p_thread
  ) then
    raise exception 'mail attachments are retained by policy' using errcode='55000';
  end if;

  select count(*) into v_message_count
  from public.mail_messages where thread_id = p_thread;

  update public.notifications
     set deleted_at = coalesce(deleted_at, now()), action_url = null, updated_at = now()
   where action_url in (
     '/admin/mail?thread=' || p_thread::text,
     '/admin/mail?folder=inbox&thread=' || p_thread::text,
     '/admin/mail?folder=sent&thread=' || p_thread::text,
     '/admin/mail?folder=trash&thread=' || p_thread::text
   );

  delete from public.mail_read_states where thread_id = p_thread;
  delete from public.mail_audit_events where thread_id = p_thread;
  perform set_config('app.mail_hard_delete', 'on', true);
  delete from public.mail_messages where thread_id = p_thread;
  perform set_config('app.mail_hard_delete', 'off', true);
  delete from public.mail_threads where id = p_thread;

  insert into public.mail_audit_events(action, actor_id, safe_metadata)
  values(
    'mail_thread_permanently_deleted',
    p_actor,
    jsonb_build_object('messageCount', v_message_count, 'attachmentCount', 0)
  );
  return v_paths;
end
$$;

revoke all on function public.permanently_delete_mail_thread(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.permanently_delete_mail_thread(uuid, uuid)
  to service_role;

-- Deleting a Supabase Auth user becomes the single atomic authority for the
-- matching application profile. Restrictive business FKs still abort deletion.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey foreign key(id) references auth.users(id) on delete cascade;

-- Invitation delivery evidence is retained without keeping an otherwise
-- unused invited account alive forever.
alter table public.email_logs drop constraint if exists email_logs_related_user_id_fkey;
alter table public.email_logs
  add constraint email_logs_related_user_id_fkey
  foreign key(related_user_id) references public.profiles(id) on delete set null;

create or replace function public.assess_member_permanent_deletion(
  p_target uuid,
  p_actor uuid
)
returns table(can_delete boolean, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_target public.profiles%rowtype;
  v_reference record;
  v_has_reference boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'member deletion assessment requires service role' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor and active and role = 'owner'
  ) then
    raise exception 'owner authorization required' using errcode='42501';
  end if;

  select * into v_target from public.profiles where id = p_target;
  if v_target.id is null then
    return query select false, 'El miembro ya no existe.'::text;
    return;
  end if;
  if v_target.role = 'owner' or p_target = p_actor then
    return query select false, 'El Owner protegido no puede eliminarse.'::text;
    return;
  end if;
  if v_target.last_login_at is not null or v_target.invitation_status = 'accepted' then
    return query select false, 'Este miembro ya completó un acceso y debe conservarse para mantener el historial de Ken Code. Puede desactivar su acceso.'::text;
    return;
  end if;
  if coalesce(v_target.profile_photo_path, '') <> '' then
    return query select false, 'Este miembro configuró información de su cuenta y debe conservarse. Puede desactivar su acceso.'::text;
    return;
  end if;
  if exists(select 1 from auth.users where id = p_target and last_sign_in_at is not null) then
    return query select false, 'Este miembro ya inició un acceso y debe conservarse para mantener el historial de Ken Code. Puede desactivar su acceso.'::text;
    return;
  end if;
  if exists(
    select 1 from public.migration_id_map
    where target_table = 'profiles' and target_id = p_target::text
  ) then
    return query select false, 'Este miembro forma parte del historial migrado y no puede eliminarse. Puede desactivar su acceso.'::text;
    return;
  end if;
  if exists(
    select 1 from public.email_logs
    where related_user_id = p_target and type <> 'user_invitation'
  ) then
    return query select false, 'Este miembro tiene comunicaciones registradas y debe conservarse. Puede desactivar su acceso.'::text;
    return;
  end if;

  for v_reference in
    select
      format('%I.%I', source_namespace.nspname, source_table.relname) as relation_name,
      source_column.attname as column_name
    from pg_constraint constraint_row
    join pg_class source_table on source_table.oid = constraint_row.conrelid
    join pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
    join lateral unnest(constraint_row.conkey) with ordinality key_column(attnum, position) on true
    join pg_attribute source_column
      on source_column.attrelid = constraint_row.conrelid
     and source_column.attnum = key_column.attnum
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.profiles'::regclass
      and not (
        source_namespace.nspname = 'public'
        and source_table.relname = 'activity_logs'
        and source_column.attname = 'target_user_id'
      )
      and not (
        source_namespace.nspname = 'public'
        and source_table.relname = 'email_logs'
        and source_column.attname = 'related_user_id'
      )
  loop
    execute format(
      'select exists(select 1 from %s where %I = $1)',
      v_reference.relation_name,
      v_reference.column_name
    ) into v_has_reference using p_target;
    if v_has_reference then
      return query select false, 'Este miembro tiene actividad registrada y debe conservarse para mantener el historial de Ken Code. Puede desactivar su acceso.'::text;
      return;
    end if;
  end loop;

  return query select true, 'Este miembro nunca tuvo actividad empresarial y puede eliminarse definitivamente.'::text;
end
$$;

revoke all on function public.assess_member_permanent_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assess_member_permanent_deletion(uuid, uuid)
  to service_role;

comment on function public.permanently_delete_mail_thread(uuid, uuid) is
  'Owner-only service boundary for unlinked, attachment-free conversations already in Trash.';
comment on function public.assess_member_permanent_deletion(uuid, uuid) is
  'Service-only proof that a non-owner profile has no login or business history before Auth deletion.';
