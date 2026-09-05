-- Identity configuration only: never update correspondence or sender snapshots.
create or replace function public.manage_mail_identity(
  p_identity_id uuid, p_action text, p_profile_id uuid default null,
  p_previous_profile_id uuid default null, p_display_name text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status public.mail_identity_status;
begin
  if not private.current_profile_active() or private.current_profile_role() <> 'owner' then
    raise exception 'Owner required' using errcode = '42501';
  end if;
  -- Serialize configuration changes, including concurrent primary switches.
  perform pg_advisory_xact_lock(9052026, 1);
  select status into v_status from mail_identities where id = p_identity_id for update;
  if not found then raise exception 'Identity not found' using errcode = 'P0002'; end if;
  if p_action in ('assign','reassign','primary') and not exists (
    select 1 from profiles where id = p_profile_id and active and role in ('owner','admin','manager','sales_agent')
  ) then raise exception 'Active authorized user required'; end if;
  if p_action = 'edit' then
    if p_display_name is null or length(btrim(p_display_name)) not between 2 and 160 or p_display_name ~ '[\r\n]' then raise exception 'Invalid display name'; end if;
    update mail_identities set display_name = btrim(p_display_name), updated_at = now() where id = p_identity_id;
  elsif p_action in ('reactivate','deactivate') then
    update mail_identities set status = case when p_action = 'reactivate' then 'active'::mail_identity_status else 'inactive'::mail_identity_status end, updated_at = now() where id = p_identity_id;
  elsif p_action in ('assign','reassign') then
    if p_action = 'reassign' then
      if p_previous_profile_id is null or p_previous_profile_id = p_profile_id then raise exception 'Different previous user required'; end if;
      update mail_identity_assignments set active = false, is_primary = false, unassigned_at = now() where identity_id = p_identity_id and profile_id = p_previous_profile_id and active;
      if not found then raise exception 'Assignment changed; reload'; end if;
    end if;
    insert into mail_identity_assignments(identity_id, profile_id, assigned_by)
      values(p_identity_id, p_profile_id, auth.uid()) on conflict (identity_id,profile_id) where active do nothing;
  elsif p_action = 'unassign' then
    update mail_identity_assignments set active = false, is_primary = false, unassigned_at = now() where identity_id = p_identity_id and profile_id = p_profile_id and active;
    if not found then raise exception 'Assignment changed; reload'; end if;
  elsif p_action in ('primary','remove_primary') then
    if not exists(select 1 from mail_identity_assignments where identity_id = p_identity_id and profile_id = p_profile_id and active) then raise exception 'Active assignment required'; end if;
    if p_action = 'primary' then
      if v_status <> 'active' then raise exception 'Active identity required'; end if;
      update mail_identity_assignments set is_primary = false where profile_id = p_profile_id and active and is_primary;
    end if;
    update mail_identity_assignments set is_primary = (p_action = 'primary') where identity_id = p_identity_id and profile_id = p_profile_id and active;
  else raise exception 'Invalid action'; end if;
  insert into mail_audit_events(action,actor_id,identity_id,safe_metadata)
    values('mail_identity_' || p_action,auth.uid(),p_identity_id,jsonb_build_object('profileId',p_profile_id,'previousProfileId',p_previous_profile_id));
end $$;
revoke all on function public.manage_mail_identity(uuid,text,uuid,uuid,text) from public, anon;
grant execute on function public.manage_mail_identity(uuid,text,uuid,uuid,text) to authenticated;
