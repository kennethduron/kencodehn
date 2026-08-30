-- Server-only privileges for Ken Code Mail. Browser access remains governed by
-- the narrower authenticated grants and FORCE RLS policies from the core schema.
grant select, insert, update on public.mail_identities to service_role;
grant select, insert, update on public.mail_identity_assignments to service_role;
grant select, insert, update on public.mail_threads to service_role;
grant select, insert on public.mail_messages to service_role;
grant select, insert, update, delete on public.mail_drafts to service_role;
grant select, insert, update, delete on public.mail_attachments to service_role;
grant select, insert, update on public.mail_read_states to service_role;
grant select, insert, update on public.mail_templates to service_role;
grant select, insert, update on public.mail_signatures to service_role;
grant select, insert, update on public.mail_follow_ups to service_role;
grant select, insert, update on public.mail_webhook_events to service_role;
grant select, insert on public.mail_audit_events to service_role;
