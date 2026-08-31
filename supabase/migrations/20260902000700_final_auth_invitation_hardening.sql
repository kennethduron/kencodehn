-- Final acceptance: serialize invitation resends and keep pending accounts distinct from activated access.
create or replace function public.claim_invitation_resend(p_target uuid, p_actor uuid, p_now timestamptz default now())
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
  v_claimed_at timestamptz := coalesce(p_now, now());
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor and active and role in ('owner', 'admin')
  ) then
    raise exception 'actor is not authorized' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_target for update;
  if v_profile.id is null then raise exception 'profile not found' using errcode = 'P0002'; end if;
  if not v_profile.active or v_profile.role = 'owner' or v_profile.last_login_at is not null
     or v_profile.invitation_status not in ('pending', 'sent', 'failed') then
    raise exception 'invitation is not pending' using errcode = '22023';
  end if;
  if greatest(
    coalesce(v_profile.invitation_last_sent_at, '-infinity'::timestamptz),
    coalesce(v_profile.invited_at, '-infinity'::timestamptz)
  ) > v_claimed_at - interval '60 seconds' then
    raise exception 'invitation resend cooldown' using errcode = 'P0001';
  end if;

  update public.profiles
  set invitation_status = 'pending', invitation_last_sent_at = v_claimed_at, invitation_error = null
  where id = p_target;
  return v_claimed_at;
end;
$$;

create or replace function public.complete_invitation_resend(
  p_target uuid,
  p_actor uuid,
  p_claimed_at timestamptz,
  p_sent boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor and active and role in ('owner', 'admin')
  ) then
    raise exception 'actor is not authorized' using errcode = '42501';
  end if;

  update public.profiles
  set invitation_status = case when p_sent then 'sent'::public.invitation_status else 'failed'::public.invitation_status end,
      invitation_error = case when p_sent then null else coalesce(nullif(btrim(p_error), ''), 'email_send_failed') end
  where id = p_target
    and invitation_last_sent_at = p_claimed_at
    and last_login_at is null
    and invitation_status = 'pending';
  if not found then raise exception 'invitation resend claim is stale' using errcode = '40001'; end if;

  if p_sent then
    insert into public.activity_logs(
      firebase_id, entity_type, entity_id, actor_id, target_user_id,
      action, title, description, created_at
    ) values (
      'supabase:' || gen_random_uuid()::text, 'user', p_target::text, p_actor, p_target,
      'user_invitation_resent', 'Invitación reenviada', 'Supabase Auth preparó un nuevo acceso de un solo uso.', now()
    );
  end if;
end;
$$;

revoke all on function public.claim_invitation_resend(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_invitation_resend(uuid, uuid, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_invitation_resend(uuid, uuid, timestamptz) to service_role;
grant execute on function public.complete_invitation_resend(uuid, uuid, timestamptz, boolean, text) to service_role;
