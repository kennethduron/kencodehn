-- Phase 2 production hardening: the server-only delivery worker records every
-- natural execution. Financial events remain RPC-only; this grant is limited
-- to the append/update audit table used by the worker.

grant select, insert, update on table public.billing_job_runs to service_role;

comment on table public.billing_job_runs is
  'Immutable scheduler execution audit. Authenticated admins may read through RLS; only the server-side service role may insert or update run status.';
