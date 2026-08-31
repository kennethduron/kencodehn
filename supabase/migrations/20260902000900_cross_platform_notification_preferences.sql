-- Personal notification delivery preferences. Business authorization remains
-- authoritative; these rows only select delivery channels for events a profile
-- is already allowed to receive.

create table public.user_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  internal_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  event_preferences jsonb not null default '{
    "mail_received":{"crm":true,"push":true,"email":true},
    "task_assigned":{"crm":true,"push":true,"email":true},
    "follow_up":{"crm":true,"push":true,"email":true},
    "billing":{"crm":true,"push":true,"email":true},
    "proposal_activity":{"crm":true,"push":true,"email":false},
    "team_activity":{"crm":true,"push":false,"email":false}
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_events_object check (jsonb_typeof(event_preferences) = 'object')
);

create trigger user_notification_preferences_set_updated_at
before update on public.user_notification_preferences
for each row execute function private.set_updated_at();

alter table public.user_notification_preferences enable row level security;
alter table public.user_notification_preferences force row level security;

grant select, insert, update on public.user_notification_preferences to authenticated;

create policy notification_preferences_read_self
on public.user_notification_preferences for select to authenticated
using (private.current_profile_active() and profile_id = auth.uid());

create policy notification_preferences_insert_self
on public.user_notification_preferences for insert to authenticated
with check (private.current_profile_active() and profile_id = auth.uid());

create policy notification_preferences_update_self
on public.user_notification_preferences for update to authenticated
using (private.current_profile_active() and profile_id = auth.uid())
with check (private.current_profile_active() and profile_id = auth.uid());

alter table public.email_logs drop constraint if exists email_logs_type_valid;
alter table public.email_logs add constraint email_logs_type_valid check (type in (
  'admin_new_lead_notification','client_lead_confirmation','task_reminder','task_overdue','status_update','daily_summary','user_invitation','owner_email_verification',
  'payment_schedule_created','payment_schedule_updated','payment_due_7_days','payment_due_3_days','payment_due_today','payment_due_time','payment_overdue_1_day','payment_received',
  'operational_notification'
));

comment on table public.user_notification_preferences is
  'Personal channel choices for authorized CRM events; never expands business data access.';
