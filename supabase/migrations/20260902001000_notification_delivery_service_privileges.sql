-- Server delivery processes need narrowly scoped writes while personal access
-- remains protected by FORCE RLS and self-only authenticated policies.

grant select, insert, update on table public.user_notification_preferences to service_role;
grant select, insert, update on table public.device_tokens to service_role;
grant select, insert, update on table public.push_logs to service_role;
grant select, insert, update on table public.email_logs to service_role;
