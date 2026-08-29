-- M3 delta compatibility: the approved Owner verification flow creates this audited email-log type.
alter table public.email_logs
  drop constraint email_logs_type_valid;

alter table public.email_logs
  add constraint email_logs_type_valid check (type in (
    'admin_new_lead_notification',
    'client_lead_confirmation',
    'task_reminder',
    'task_overdue',
    'status_update',
    'daily_summary',
    'user_invitation',
    'owner_email_verification'
  ));
