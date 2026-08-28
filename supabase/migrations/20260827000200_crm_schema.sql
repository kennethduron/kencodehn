-- Ken Code M1: PostgreSQL equivalents for the current Firebase CRM only.
create type public.lead_status as enum ('new', 'contacted', 'conversation', 'quoted', 'won', 'lost');
create type public.lead_priority as enum ('low', 'medium', 'high');
create type public.payment_status as enum ('not_started', 'pending', 'partial', 'paid', 'overdue', 'active');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.task_type as enum ('call', 'whatsapp', 'email', 'meeting', 'proposal', 'follow_up');
create type public.notification_severity as enum ('info', 'success', 'warning', 'danger');
create type public.reminder_kind as enum ('one_day', 'one_hour', 'due', 'overdue');
create type public.reminder_event_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  name text not null,
  business text not null default '',
  email text not null default '',
  phone text not null default '',
  project text not null default '',
  budget text not null default '',
  message text not null default '',
  locale text not null default 'es' check (locale in ('es', 'en')),
  status public.lead_status not null default 'new',
  priority public.lead_priority not null default 'medium',
  estimated_value_minor bigint not null default 0 check (estimated_value_minor >= 0),
  initial_project_amount_minor bigint not null default 0 check (initial_project_amount_minor >= 0),
  monthly_fee_minor bigint not null default 0 check (monthly_fee_minor >= 0),
  won_value_minor bigint not null default 0 check (won_value_minor >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_status public.payment_status not null default 'not_started',
  billing_start_date date,
  billing_notes text not null default '',
  last_contact_at timestamptz,
  next_action text not null default '',
  follow_up_at timestamptz,
  follow_up_timezone text not null default 'America/Tegucigalpa',
  assigned_to uuid references public.profiles(id) on delete restrict,
  assigned_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  assigned_to_email text,
  assigned_by_email text,
  source text not null default 'public_website',
  source_path text not null default '/cotizar',
  metadata jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  legacy_crm jsonb not null default '{}'::jsonb,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint leads_firebase_id_nonempty check (length(btrim(firebase_id)) between 1 and 500),
  constraint leads_assignment_dates check (assigned_to is not null or assigned_at is null)
);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  lead_id uuid not null references public.leads(id) on delete restrict,
  body text not null check (length(btrim(body)) > 0),
  author_id uuid references public.profiles(id) on delete set null,
  author_firebase_uid text,
  author_email text,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  constraint lead_notes_firebase_id_nonempty check (length(btrim(firebase_id)) between 1 and 500)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  lead_id uuid references public.leads(id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  type public.task_type not null default 'follow_up',
  status public.task_status not null default 'pending',
  priority public.task_priority not null default 'medium',
  due_date date,
  due_time time without time zone,
  timezone text not null default 'America/Tegucigalpa',
  due_at timestamptz,
  reminder_at timestamptz,
  reminder_one_day_sent_at timestamptz,
  reminder_one_hour_sent_at timestamptz,
  due_notification_sent_at timestamptz,
  overdue_email_sent_at timestamptz,
  overdue_notified_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete restrict,
  assigned_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_to_name text,
  assigned_to_email text,
  assigned_by_email text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_email text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_by_email text,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint tasks_firebase_id_nonempty check (length(btrim(firebase_id)) between 1 and 500),
  constraint tasks_completed_consistency check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  recipient_id uuid references public.profiles(id) on delete restrict,
  recipient_name text,
  recipient_email text,
  lead_id uuid references public.leads(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete restrict,
  type text not null,
  severity public.notification_severity not null default 'info',
  title text not null,
  message text not null,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  deleted_at timestamptz,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint notifications_type_valid check (type in (
    'lead', 'task', 'lead_new', 'lead_status_changed', 'lead_priority_changed',
    'note_added', 'task_created', 'task_updated', 'task_completed',
    'task_reminder', 'task_due', 'task_overdue', 'system'
  )),
  constraint notifications_read_consistency check (is_read or read_at is null)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  entity_type text not null check (entity_type in ('lead', 'note', 'task', 'notification', 'user', 'system')),
  entity_id text not null,
  lead_id uuid references public.leads(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete restrict,
  note_id uuid references public.lead_notes(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_firebase_uid text,
  actor_email text,
  recipient_id uuid references public.profiles(id) on delete restrict,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  title text not null default '',
  description text not null default '',
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  constraint activity_logs_firebase_id_nonempty check (length(btrim(firebase_id)) between 1 and 500),
  constraint activity_logs_action_nonempty check (length(btrim(action)) > 0)
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  token text not null,
  token_hash text not null unique,
  platform text not null default '',
  user_agent text not null default '',
  active boolean not null default true,
  disabled_by uuid references public.profiles(id) on delete set null,
  disabled_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint device_tokens_firebase_id_nonempty check (length(btrim(firebase_id)) between 1 and 500),
  constraint device_tokens_hash_nonempty check (length(btrim(token_hash)) >= 32)
);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  type text not null,
  recipient text,
  subject text not null default '',
  sent boolean not null,
  reason text,
  provider_id text,
  provider_message_id text,
  lead_id uuid references public.leads(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete restrict,
  related_user_id uuid references public.profiles(id) on delete restrict,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  constraint email_logs_type_valid check (type in (
    'admin_new_lead_notification', 'client_lead_confirmation', 'task_reminder',
    'task_overdue', 'status_update', 'daily_summary', 'user_invitation'
  ))
);

create unique index email_logs_idempotency_idx on public.email_logs (idempotency_key) where idempotency_key is not null;

create table public.push_logs (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  device_token_id uuid references public.device_tokens(id) on delete restrict,
  type text not null,
  title text not null default '',
  message text not null default '',
  sent boolean not null,
  reason text,
  lead_id uuid references public.leads(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete restrict,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create unique index push_logs_delivery_idx
on public.push_logs (idempotency_key, device_token_id)
where idempotency_key is not null and device_token_id is not null;

create table public.admin_settings (
  id text primary key default 'default' check (id = 'default'),
  firebase_id text unique,
  email_notifications_enabled boolean not null default true,
  push_notifications_enabled boolean not null default true,
  internal_notifications_enabled boolean not null default true,
  task_reminder_one_day_enabled boolean not null default true,
  task_reminder_one_hour_enabled boolean not null default true,
  task_due_enabled boolean not null default true,
  task_overdue_enabled boolean not null default true,
  daily_summary_enabled boolean not null default false,
  notification_sound_enabled boolean not null default true,
  compact_mode_enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_by_email text,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  firebase_id text not null unique,
  deterministic_key text not null unique,
  task_id uuid not null references public.tasks(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  kind public.reminder_kind not null,
  status public.reminder_event_status not null default 'pending',
  notification_status public.delivery_status not null default 'pending',
  notification_error text,
  email_status public.delivery_status not null default 'pending',
  email_error text,
  push_status public.delivery_status not null default 'pending',
  push_error text,
  attempts integer not null default 0 check (attempts >= 0),
  lease_token uuid,
  lease_until timestamptz,
  retry_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_events_firebase_id_nonempty check (length(btrim(firebase_id)) between 1 and 500),
  constraint reminder_events_key_nonempty check (length(btrim(deterministic_key)) > 0),
  constraint reminder_events_lease_consistency check (
    (status = 'processing' and lease_until is not null)
    or status <> 'processing'
  )
);

create index leads_assigned_created_idx on public.leads (assigned_to, created_at desc);
create index leads_status_idx on public.leads (status);
create index leads_follow_up_idx on public.leads (follow_up_at) where follow_up_at is not null;
create index lead_notes_lead_created_idx on public.lead_notes (lead_id, created_at desc);
create index tasks_assigned_created_idx on public.tasks (assigned_to, created_at desc);
create index tasks_status_due_idx on public.tasks (status, due_at);
create index tasks_lead_idx on public.tasks (lead_id) where lead_id is not null;
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index activity_logs_lead_created_idx on public.activity_logs (lead_id, created_at desc);
create index activity_logs_recipient_created_idx on public.activity_logs (recipient_id, created_at desc);
create index reminder_events_status_retry_idx on public.reminder_events (status, retry_at);
create index reminder_events_lease_idx on public.reminder_events (lease_until) where status = 'processing';
create index device_tokens_profile_active_idx on public.device_tokens (profile_id, active);

create trigger leads_set_updated_at before update on public.leads for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger notifications_set_updated_at before update on public.notifications for each row execute function private.set_updated_at();
create trigger device_tokens_set_updated_at before update on public.device_tokens for each row execute function private.set_updated_at();
create trigger admin_settings_set_updated_at before update on public.admin_settings for each row execute function private.set_updated_at();
create trigger reminder_events_set_updated_at before update on public.reminder_events for each row execute function private.set_updated_at();

comment on table public.activity_logs is 'Append-oriented CRM audit log; authenticated roles receive no UPDATE or DELETE grant.';
comment on table public.reminder_events is 'Deterministic, lease-based reminder delivery state for idempotent concurrent processing.';
