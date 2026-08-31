-- Optional delivery channels are opt-in. Internal CRM notifications remain on
-- unless the user deliberately changes the personal preference.

alter table public.user_notification_preferences
  alter column push_enabled set default false,
  alter column email_enabled set default false;
