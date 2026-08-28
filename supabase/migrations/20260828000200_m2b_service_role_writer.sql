-- M2B: least-privilege service-role reads for guarded preflight and reconciliation.
grant usage on schema public to service_role;

grant select on table
  public.profiles,
  public.leads,
  public.lead_notes,
  public.tasks,
  public.notifications,
  public.activity_logs,
  public.email_logs,
  public.push_logs,
  public.device_tokens,
  public.admin_settings,
  public.reminder_events,
  public.migration_id_map,
  public.migration_checkpoints
to service_role;
