-- Phase 5: corporate identities and durable, auditable CRM mail.
create type public.mail_identity_status as enum ('active','inactive','archived');
create type public.mail_thread_state as enum ('inbox','archived','trash');
create type public.mail_direction as enum ('inbound','outbound');
create type public.mail_delivery_status as enum ('received','queued','sent','failed');

create table public.mail_identities (
  id uuid primary key default gen_random_uuid(), local_part text not null unique,
  email text generated always as (local_part||'@kencodehn.com') stored,
  display_name text not null, status public.mail_identity_status not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint mail_identity_local_part_valid check(local_part=lower(btrim(local_part)) and local_part ~ '^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$'),
  constraint mail_identity_reserved check(local_part not in ('abuse','postmaster','mailer-daemon','root','admin','administrator','security','noreply','no-reply')),
  constraint mail_identity_name_valid check(length(btrim(display_name)) between 2 and 160)
);
create table public.mail_identity_assignments (
  id uuid primary key default gen_random_uuid(), identity_id uuid not null references public.mail_identities(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict, is_primary boolean not null default false,
  active boolean not null default true, assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(), unassigned_at timestamptz,
  constraint mail_assignment_state check((active and unassigned_at is null) or (not active and unassigned_at is not null))
);
create unique index mail_identity_active_assignment_uq on public.mail_identity_assignments(identity_id,profile_id) where active;
create unique index mail_profile_primary_identity_uq on public.mail_identity_assignments(profile_id) where active and is_primary;

create table public.mail_threads (
  id uuid primary key default gen_random_uuid(), identity_id uuid not null references public.mail_identities(id) on delete restrict,
  subject text not null default '(Sin asunto)', state public.mail_thread_state not null default 'inbox', assigned_to uuid references public.profiles(id) on delete restrict,
  is_important boolean not null default false, follow_up_at timestamptz, snippet text not null default '',
  lead_id uuid references public.leads(id) on delete restrict, client_id uuid references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict, add_on_id uuid references public.project_add_ons(id) on delete restrict,
  proposal_id uuid references public.add_on_proposals(id) on delete restrict,
  latest_message_at timestamptz not null default now(), created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint mail_thread_subject_safe check(length(subject)<=998 and subject !~ E'[\r\n]'),
  constraint mail_thread_snippet_safe check(length(snippet)<=500)
);
create table public.mail_messages (
  id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.mail_threads(id) on delete restrict,
  direction public.mail_direction not null, delivery_status public.mail_delivery_status not null,
  provider_email_id text unique, provider_event_id text, message_id text unique, in_reply_to text, reference_ids text[] not null default '{}',
  from_address jsonb not null, to_addresses jsonb not null default '[]', cc_addresses jsonb not null default '[]', bcc_addresses jsonb not null default '[]',
  subject text not null default '(Sin asunto)', body_html text not null default '', body_text text not null default '',
  sent_by uuid references public.profiles(id) on delete restrict, sender_identity_id uuid references public.mail_identities(id) on delete restrict,
  sender_snapshot jsonb not null default '{}', has_remote_images boolean not null default false,
  sent_at timestamptz, received_at timestamptz, created_at timestamptz not null default now(),
  constraint mail_message_subject_safe check(length(subject)<=998 and subject !~ E'[\r\n]'),
  constraint mail_message_body_limits check(length(body_html)<=2000000 and length(body_text)<=1000000)
);
create table public.mail_drafts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
  thread_id uuid references public.mail_threads(id) on delete restrict, identity_id uuid references public.mail_identities(id) on delete restrict,
  to_addresses jsonb not null default '[]', cc_addresses jsonb not null default '[]', bcc_addresses jsonb not null default '[]',
  subject text not null default '', body_html text not null default '', body_text text not null default '',
  lead_id uuid references public.leads(id) on delete restrict, client_id uuid references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict, add_on_id uuid references public.project_add_ons(id) on delete restrict,
  proposal_id uuid references public.add_on_proposals(id) on delete restrict, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint mail_draft_subject_safe check(length(subject)<=998 and subject !~ E'[\r\n]')
);
create table public.mail_attachments (
  id uuid primary key default gen_random_uuid(), message_id uuid references public.mail_messages(id) on delete restrict,
  draft_id uuid references public.mail_drafts(id) on delete restrict, provider_attachment_id text,
  storage_path text not null unique, filename text not null, content_type text not null, size_bytes bigint not null,
  content_id text, inline boolean not null default false, created_at timestamptz not null default now(),
  constraint mail_attachment_parent check((message_id is null)<>(draft_id is null)),
  constraint mail_attachment_size check(size_bytes>0 and size_bytes<=10485760),
  constraint mail_attachment_path check(storage_path ~ '^[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$'),
  constraint mail_attachment_filename check(length(btrim(filename)) between 1 and 255 and filename !~ E'[\r\n]')
);
create table public.mail_read_states (
  thread_id uuid not null references public.mail_threads(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  last_read_at timestamptz not null default now(), unread boolean not null default false,
  primary key(thread_id,profile_id)
);
create table public.mail_templates (
  id uuid primary key default gen_random_uuid(), name text not null, subject text not null default '', body_html text not null,
  active boolean not null default true, created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint mail_template_name check(length(btrim(name)) between 2 and 120)
);
create table public.mail_signatures (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete restrict,
  identity_id uuid references public.mail_identities(id) on delete restrict, name text not null, body_html text not null,
  is_default boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index mail_signature_default_uq on public.mail_signatures(profile_id,coalesce(identity_id,'00000000-0000-0000-0000-000000000000'::uuid)) where is_default;
create table public.mail_follow_ups (
  id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.mail_threads(id) on delete restrict,
  assigned_to uuid not null references public.profiles(id) on delete restrict, due_at timestamptz not null,
  completed_at timestamptz, created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.mail_webhook_events (
  provider_event_id text primary key, event_type text not null, payload_hash text not null,
  status text not null default 'processing' check(status in ('processing','processed','ignored','failed')),
  received_at timestamptz not null default now(), processed_at timestamptz, error_category text
);
create table public.mail_audit_events (
  id uuid primary key default gen_random_uuid(), action text not null, actor_id uuid references public.profiles(id) on delete set null,
  identity_id uuid references public.mail_identities(id) on delete restrict, thread_id uuid references public.mail_threads(id) on delete restrict,
  message_id uuid references public.mail_messages(id) on delete restrict, draft_id uuid references public.mail_drafts(id) on delete restrict,
  safe_metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create index mail_threads_latest_idx on public.mail_threads(latest_message_at desc,id);
create index mail_threads_identity_idx on public.mail_threads(identity_id,state,latest_message_at desc);
create index mail_threads_assignee_idx on public.mail_threads(assigned_to,latest_message_at desc);
create index mail_messages_thread_idx on public.mail_messages(thread_id,created_at);
create index mail_messages_reply_idx on public.mail_messages(in_reply_to) where in_reply_to is not null;
create index mail_drafts_owner_idx on public.mail_drafts(owner_id,updated_at desc);
create index mail_followups_assignee_idx on public.mail_follow_ups(assigned_to,due_at) where completed_at is null;

create or replace function private.mail_thread_in_current_scope(p_thread uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select private.current_profile_active() and exists(select 1 from public.mail_threads t where t.id=p_thread and (
    private.current_profile_role() in ('owner','admin','manager') or t.assigned_to=auth.uid() or exists(select 1 from public.mail_identity_assignments a where a.identity_id=t.identity_id and a.profile_id=auth.uid() and a.active)
  ))
$$;
create or replace function private.prevent_mail_message_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'delivered messages are immutable' using errcode='42501'; end $$;
create trigger mail_messages_immutable before update or delete on public.mail_messages for each row execute function private.prevent_mail_message_mutation();

do $$ declare t text; begin foreach t in array array['mail_identities','mail_identity_assignments','mail_threads','mail_messages','mail_drafts','mail_attachments','mail_read_states','mail_templates','mail_signatures','mail_follow_ups','mail_webhook_events','mail_audit_events'] loop execute format('alter table public.%I enable row level security',t); execute format('alter table public.%I force row level security',t); end loop; end $$;
create policy mail_identities_read on public.mail_identities for select to authenticated using(private.current_profile_active() and (private.current_profile_role() in ('owner','admin','manager') or exists(select 1 from public.mail_identity_assignments a where a.identity_id=id and a.profile_id=auth.uid() and a.active)));
create policy mail_assignments_read on public.mail_identity_assignments for select to authenticated using(private.current_profile_active() and (private.current_profile_role() in ('owner','admin','manager') or profile_id=auth.uid()));
create policy mail_threads_read on public.mail_threads for select to authenticated using(private.mail_thread_in_current_scope(id));
create policy mail_messages_read on public.mail_messages for select to authenticated using(private.mail_thread_in_current_scope(thread_id));
create policy mail_drafts_read on public.mail_drafts for select to authenticated using(private.current_profile_active() and owner_id=auth.uid());
create policy mail_attachments_read on public.mail_attachments for select to authenticated using(private.current_profile_active() and ((mail_attachments.message_id is not null and exists(select 1 from public.mail_messages m where m.id=mail_attachments.message_id and private.mail_thread_in_current_scope(m.thread_id))) or (mail_attachments.draft_id is not null and exists(select 1 from public.mail_drafts d where d.id=mail_attachments.draft_id and d.owner_id=auth.uid()))));
create policy mail_read_states_read on public.mail_read_states for select to authenticated using(private.current_profile_active() and profile_id=auth.uid() and private.mail_thread_in_current_scope(thread_id));
create policy mail_templates_read on public.mail_templates for select to authenticated using(private.current_profile_active() and active);
create policy mail_signatures_read on public.mail_signatures for select to authenticated using(private.current_profile_active() and profile_id=auth.uid());
create policy mail_followups_read on public.mail_follow_ups for select to authenticated using(private.current_profile_active() and (assigned_to=auth.uid() or private.current_profile_role() in ('owner','admin','manager')) and private.mail_thread_in_current_scope(thread_id));
create policy mail_audit_read on public.mail_audit_events for select to authenticated using(private.current_profile_active() and private.current_profile_role() in ('owner','admin','manager'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mail-attachments','mail-attachments',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
revoke all on all tables in schema public from anon;
grant select on public.mail_identities,public.mail_identity_assignments,public.mail_threads,public.mail_messages,public.mail_drafts,public.mail_attachments,public.mail_read_states,public.mail_templates,public.mail_signatures,public.mail_follow_ups,public.mail_audit_events to authenticated;
grant execute on function private.mail_thread_in_current_scope(uuid) to authenticated;

alter table public.notifications drop constraint if exists notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check(type in ('lead','task','lead_new','lead_status_changed','lead_priority_changed','note_added','task_created','task_updated','task_completed','task_reminder','task_due','task_overdue','system','mail_received','mail_assigned','mail_follow_up'));
