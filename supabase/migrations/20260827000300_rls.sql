-- Ken Code M1: explicit grants, RLS scopes, and privilege-escalation guards.
create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid() and p.active = true
$$;

create or replace function private.current_profile_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce((select p.active from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function private.has_global_lead_scope()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.current_profile_role() in ('owner', 'admin', 'manager', 'viewer')
$$;

create or replace function private.is_operations_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.current_profile_role() in ('owner', 'admin')
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.current_profile_role() = 'owner'
$$;

create or replace function private.lead_belongs_to_current_user(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and l.assigned_to = auth.uid()
  )
$$;

create or replace function private.task_in_current_scope(p_assigned_to uuid, p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p_assigned_to = auth.uid()
    and (p_lead_id is null or private.lead_belongs_to_current_user(p_lead_id))
$$;

create or replace function private.guard_lead_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null
    and (old.assigned_to, old.assigned_at, old.assigned_by)
      is distinct from
      (new.assigned_to, new.assigned_at, new.assigned_by)
    and not private.is_operations_admin()
  then
    raise exception 'lead assignment requires owner or admin';
  end if;
  return new;
end;
$$;

create trigger leads_guard_assignment
before update on public.leads
for each row execute function private.guard_lead_assignment();

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.current_profile_active() to authenticated;
grant execute on function private.has_global_lead_scope() to authenticated;
grant execute on function private.is_operations_admin() to authenticated;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.lead_belongs_to_current_user(uuid) to authenticated;
grant execute on function private.task_in_current_scope(uuid, uuid) to authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update on public.leads to authenticated;
grant select, insert on public.lead_notes to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select, insert, update on public.device_tokens to authenticated;
grant select on public.email_logs, public.push_logs, public.reminder_events to authenticated;
grant select, update on public.admin_settings to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.migration_id_map enable row level security;
alter table public.migration_id_map force row level security;
alter table public.leads enable row level security;
alter table public.leads force row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_notes force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;
alter table public.email_logs enable row level security;
alter table public.email_logs force row level security;
alter table public.push_logs enable row level security;
alter table public.push_logs force row level security;
alter table public.device_tokens enable row level security;
alter table public.device_tokens force row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_settings force row level security;
alter table public.reminder_events enable row level security;
alter table public.reminder_events force row level security;

create policy profiles_read_self_or_owner on public.profiles
for select to authenticated
using (private.current_profile_active() and (id = auth.uid() or private.is_owner()));

create policy leads_read_scoped on public.leads
for select to authenticated
using (
  private.current_profile_active()
  and (private.has_global_lead_scope() or assigned_to = auth.uid())
);

create policy leads_insert_admin on public.leads
for insert to authenticated
with check (private.is_operations_admin());

create policy leads_update_scoped on public.leads
for update to authenticated
using (
  private.current_profile_active()
  and (
    private.current_profile_role() in ('owner', 'admin', 'manager')
    or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  )
)
with check (
  private.current_profile_active()
  and (
    private.current_profile_role() in ('owner', 'admin', 'manager')
    or (private.current_profile_role() = 'sales_agent' and assigned_to = auth.uid())
  )
);

create policy lead_notes_read_scoped on public.lead_notes
for select to authenticated
using (
  private.is_operations_admin()
  or (private.current_profile_role() = 'sales_agent' and private.lead_belongs_to_current_user(lead_id))
);

create policy lead_notes_insert_scoped on public.lead_notes
for insert to authenticated
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and author_id = auth.uid()
    and private.lead_belongs_to_current_user(lead_id)
  )
);

create policy tasks_read_scoped on public.tasks
for select to authenticated
using (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id)
  )
);

create policy tasks_insert_scoped on public.tasks
for insert to authenticated
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id)
    and created_by = auth.uid()
  )
);

create policy tasks_update_scoped on public.tasks
for update to authenticated
using (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id)
  )
)
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and private.task_in_current_scope(assigned_to, lead_id)
  )
);

create policy tasks_delete_admin on public.tasks
for delete to authenticated
using (private.is_operations_admin());

create policy notifications_read_scoped on public.notifications
for select to authenticated
using (
  (private.is_operations_admin() and (recipient_id = auth.uid() or recipient_id is null))
  or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
);

create policy notifications_insert_admin on public.notifications
for insert to authenticated
with check (private.is_operations_admin());

create policy notifications_update_scoped on public.notifications
for update to authenticated
using (
  (private.is_operations_admin() and (recipient_id = auth.uid() or recipient_id is null))
  or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
)
with check (
  (private.is_operations_admin() and (recipient_id = auth.uid() or recipient_id is null))
  or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
);

create policy notifications_delete_scoped on public.notifications
for delete to authenticated
using (
  (private.is_operations_admin() and (recipient_id = auth.uid() or recipient_id is null))
  or (private.current_profile_role() = 'sales_agent' and recipient_id = auth.uid())
);

create policy activity_logs_read_scoped on public.activity_logs
for select to authenticated
using (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and (recipient_id = auth.uid() or (lead_id is not null and private.lead_belongs_to_current_user(lead_id)))
  )
);

create policy activity_logs_insert_scoped on public.activity_logs
for insert to authenticated
with check (
  private.is_operations_admin()
  or (
    private.current_profile_role() = 'sales_agent'
    and actor_id = auth.uid()
    and (recipient_id = auth.uid() or (lead_id is not null and private.lead_belongs_to_current_user(lead_id)))
  )
);

create policy device_tokens_read_scoped on public.device_tokens
for select to authenticated
using (private.is_operations_admin() or profile_id = auth.uid());

create policy device_tokens_insert_self on public.device_tokens
for insert to authenticated
with check (private.current_profile_active() and profile_id = auth.uid());

create policy device_tokens_update_self on public.device_tokens
for update to authenticated
using (private.current_profile_active() and profile_id = auth.uid())
with check (private.current_profile_active() and profile_id = auth.uid());

create policy email_logs_read_admin on public.email_logs
for select to authenticated
using (private.is_operations_admin());

create policy push_logs_read_admin on public.push_logs
for select to authenticated
using (private.is_operations_admin());

create policy admin_settings_read_admin on public.admin_settings
for select to authenticated
using (private.is_operations_admin());

create policy admin_settings_update_admin on public.admin_settings
for update to authenticated
using (private.is_operations_admin())
with check (private.is_operations_admin());

create policy reminder_events_read_admin on public.reminder_events
for select to authenticated
using (private.is_operations_admin());

comment on function private.current_profile_role() is 'Returns the active CRM role for auth.uid(); fixed search_path prevents object shadowing.';
comment on function private.guard_lead_assignment() is 'Prevents Manager/Sales Agent direct-client assignment changes; service-role server operations remain authoritative.';

