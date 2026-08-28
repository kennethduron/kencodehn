-- M2B application readiness: service-role account administration with transactional profile/audit writes.
create or replace function public.provision_invited_profile(
  p_id uuid, p_email text, p_name text, p_role public.crm_role, p_actor uuid
)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if p_role = 'owner' then raise exception 'owner invitation is forbidden'; end if;
  if not exists (select 1 from public.profiles where id=p_actor and active and role in ('owner','admin')) then
    raise exception 'actor is not authorized';
  end if;
  insert into public.profiles(id,name,email,role,active,invitation_status,invited_at,invited_by)
  values(p_id,btrim(p_name),lower(btrim(p_email)),p_role,true,'sent',now(),p_actor);
  insert into public.activity_logs(firebase_id,entity_type,entity_id,actor_id,target_user_id,action,title,description,after_data,created_at)
  values('supabase:'||gen_random_uuid()::text,'user',p_id::text,p_actor,p_id,'user_invited','Usuario invitado','Invitación de Supabase Auth preparada.',jsonb_build_object('role',p_role),now());
end; $$;

create or replace function public.admin_update_profile(p_target uuid, p_changes jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare target public.profiles%rowtype;
begin
  if not exists (select 1 from public.profiles where id=p_actor and active and role in ('owner','admin')) then raise exception 'actor is not authorized'; end if;
  if p_changes - array['name','role','active'] <> '{}'::jsonb then raise exception 'unsupported profile change'; end if;
  select * into target from public.profiles where id=p_target for update;
  if target.id is null then raise exception 'profile not found'; end if;
  if target.role='owner' then raise exception 'owner cannot be changed'; end if;
  if p_target=p_actor and (p_changes ? 'role' or (p_changes ? 'active' and not (p_changes->>'active')::boolean)) then raise exception 'self lockout forbidden'; end if;
  if p_changes ? 'role' and (p_changes->>'role') not in ('admin','manager','viewer','sales_agent') then raise exception 'role is not manageable'; end if;
  update public.profiles set
    name=case when p_changes ? 'name' then btrim(p_changes->>'name') else name end,
    role=case when p_changes ? 'role' then (p_changes->>'role')::public.crm_role else role end,
    active=case when p_changes ? 'active' then (p_changes->>'active')::boolean else active end
  where id=p_target;
  insert into public.activity_logs(firebase_id,entity_type,entity_id,actor_id,target_user_id,action,title,description,before_data,after_data,created_at)
  values('supabase:'||gen_random_uuid()::text,'user',p_target::text,p_actor,p_target,'user_updated','Usuario actualizado','Perfil actualizado de forma transaccional.',jsonb_build_object('role',target.role,'active',target.active),p_changes,now());
end; $$;

create or replace function public.record_invitation_resent(p_target uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not exists (select 1 from public.profiles where id=p_actor and active and role in ('owner','admin')) then raise exception 'actor is not authorized'; end if;
  update public.profiles set invitation_status='sent', invitation_last_sent_at=now(), invitation_error=null where id=p_target and role<>'owner';
  if not found then raise exception 'profile not found or protected'; end if;
  insert into public.activity_logs(firebase_id,entity_type,entity_id,actor_id,target_user_id,action,title,description,created_at)
  values('supabase:'||gen_random_uuid()::text,'user',p_target::text,p_actor,p_target,'user_invitation_resent','Invitación reenviada','Supabase Auth reenvió la invitación.',now());
end; $$;

revoke all on function public.provision_invited_profile(uuid,text,text,public.crm_role,uuid) from public,anon,authenticated;
revoke all on function public.admin_update_profile(uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.record_invitation_resent(uuid,uuid) from public,anon,authenticated;
grant execute on function public.provision_invited_profile(uuid,text,text,public.crm_role,uuid) to service_role;
grant execute on function public.admin_update_profile(uuid,jsonb,uuid) to service_role;
grant execute on function public.record_invitation_resent(uuid,uuid) to service_role;

create or replace function public.record_profile_login(p_target uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  update public.profiles set last_login_at=now(), invitation_status=case when invitation_status in ('pending','sent','failed') then 'accepted' else invitation_status end, invitation_error=null where id=p_target and active;
  if not found then raise exception 'active profile not found'; end if;
end; $$;

create or replace function public.record_password_changed(p_target uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not exists(select 1 from public.profiles where id=p_target and active) then raise exception 'active profile not found'; end if;
  insert into public.activity_logs(firebase_id,entity_type,entity_id,actor_id,target_user_id,action,title,description,metadata,created_at)
  values('supabase-security:'||gen_random_uuid()::text,'user',p_target::text,p_target,p_target,'password_changed','Contraseña actualizada','La cuenta completó una actualización de contraseña con verificación.',jsonb_build_object('provider','supabase','verified',true),now());
end; $$;

revoke all on function public.record_profile_login(uuid) from public,anon,authenticated;
revoke all on function public.record_password_changed(uuid) from public,anon,authenticated;
grant execute on function public.record_profile_login(uuid) to service_role;
grant execute on function public.record_password_changed(uuid) to service_role;
