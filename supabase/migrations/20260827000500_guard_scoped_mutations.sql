-- Ken Code M1: RLS limits rows; these guards also protect sensitive columns.
create or replace function private.current_profile_email()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p.email from public.profiles p where p.id = auth.uid() and p.active = true
$$;

revoke all on function private.current_profile_email() from public, anon, authenticated;
grant execute on function private.current_profile_email() to authenticated;

create or replace function private.guard_lead_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null
    and (
      old.assigned_to,
      old.assigned_at,
      old.assigned_by,
      old.assigned_to_name,
      old.assigned_to_email,
      old.assigned_by_email
    ) is distinct from (
      new.assigned_to,
      new.assigned_at,
      new.assigned_by,
      new.assigned_to_name,
      new.assigned_to_email,
      new.assigned_by_email
    )
    and not private.is_operations_admin()
  then
    raise exception 'lead assignment requires owner or admin';
  end if;
  return new;
end;
$$;

create or replace function private.guard_task_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or private.is_operations_admin() then
    return new;
  end if;
  if (
    old.assigned_to,
    old.assigned_at,
    old.assigned_by,
    old.assigned_to_name,
    old.assigned_to_email,
    old.assigned_by_email,
    old.created_by,
    old.created_by_email
  ) is distinct from (
    new.assigned_to,
    new.assigned_at,
    new.assigned_by,
    new.assigned_to_name,
    new.assigned_to_email,
    new.assigned_by_email,
    new.created_by,
    new.created_by_email
  ) then
    raise exception 'task identity fields cannot be changed by this role';
  end if;
  if new.completed_by is distinct from old.completed_by
    and new.completed_by is not null
    and new.completed_by <> auth.uid()
  then
    raise exception 'task completion actor must match auth.uid()';
  end if;
  if new.completed_by_email is distinct from old.completed_by_email
    and new.completed_by_email is not null
    and new.completed_by_email <> private.current_profile_email()
  then
    raise exception 'task completion email must match the active profile';
  end if;
  return new;
end;
$$;

create trigger tasks_guard_identity
before update on public.tasks
for each row execute function private.guard_task_identity();

create or replace function private.guard_notification_content()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null
    and not private.is_operations_admin()
    and (to_jsonb(new) - array['is_read', 'read_at', 'deleted_at', 'updated_at'])
      is distinct from
      (to_jsonb(old) - array['is_read', 'read_at', 'deleted_at', 'updated_at'])
  then
    raise exception 'only notification state can be changed by this role';
  end if;
  return new;
end;
$$;

create trigger notifications_guard_content
before update on public.notifications
for each row execute function private.guard_notification_content();

revoke all on function private.guard_lead_assignment() from public, anon, authenticated;
revoke all on function private.guard_task_identity() from public, anon, authenticated;
revoke all on function private.guard_notification_content() from public, anon, authenticated;

comment on function private.guard_task_identity() is 'Prevents scoped users from forging task ownership, creator, or completion actor fields.';
comment on function private.guard_notification_content() is 'Limits scoped users to read/deleted notification state fields.';
