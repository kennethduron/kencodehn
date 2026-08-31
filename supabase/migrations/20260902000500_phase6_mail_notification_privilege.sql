-- The signed inbound webhook writes one user-scoped notification after storing
-- a message. Keep the service-role capability minimal and explicit.
grant insert on table public.notifications to service_role;

comment on table public.notifications is
  'CRM notifications; service_role may insert trusted server-generated events while browser access remains RLS-scoped.';
