-- Deep production audit remediation: secure usernames, durable Mail branding,
-- device lifecycle metadata, and indexes for the audited daily workflows.

create or replace function private.canonical_username(p_value text)
returns text language sql immutable set search_path = pg_catalog as $$
  select lower(btrim(normalize(coalesce(p_value, ''), NFKC)))
$$;

alter table public.profiles
  add column username text,
  add column username_canonical text;

alter table public.profiles
  add constraint profiles_username_pair check ((username is null) = (username_canonical is null)),
  add constraint profiles_username_original_length check (username is null or length(username) between 3 and 32),
  add constraint profiles_username_canonical_valid check (
    username_canonical is null or (
      username_canonical = private.canonical_username(username)
      and username_canonical ~ '^[a-z0-9](?:[a-z0-9._]{1,30}[a-z0-9])$'
      and username_canonical !~ '[._]{2}'
    )
  );

create unique index profiles_username_canonical_uq
  on public.profiles(username_canonical)
  where username_canonical is not null;

create table public.reserved_usernames (
  username_canonical text primary key,
  reason text not null default 'reserved',
  created_at timestamptz not null default now(),
  constraint reserved_username_valid check (username_canonical = private.canonical_username(username_canonical))
);

insert into public.reserved_usernames(username_canonical, reason) values
  ('admin','Administración'),('administrator','Administración'),('api','Sistema'),
  ('auth','Sistema'),('billing','Facturación'),('kencode','Marca'),('mail','Correo'),
  ('owner','Cuenta protegida'),('root','Sistema'),('security','Seguridad'),
  ('support','Soporte'),('system','Sistema')
on conflict do nothing;

create table public.username_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  username text not null,
  username_canonical text not null,
  reserved_until timestamptz,
  permanently_reserved boolean not null default false,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint username_history_canonical_valid check (username_canonical = private.canonical_username(username))
);
create index username_history_lookup_idx on public.username_history(username_canonical, reserved_until desc);

create or replace function private.preserve_deleted_username()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if old.username_canonical is not null then
    insert into public.username_history(profile_id, username, username_canonical, reserved_until, permanently_reserved)
    values(old.id, old.username, old.username_canonical,
      case when old.role in ('owner','admin') then null else now() + interval '180 days' end,
      old.role in ('owner','admin'));
  end if;
  return old;
end; $$;
create trigger profiles_preserve_deleted_username
before delete on public.profiles for each row execute function private.preserve_deleted_username();

create table public.auth_login_attempts (
  id bigint generated always as identity primary key,
  attempt_key text not null,
  successful boolean not null default false,
  created_at timestamptz not null default now(),
  constraint auth_login_attempt_key_safe check (attempt_key ~ '^[a-f0-9]{64}$')
);
create index auth_login_attempts_window_idx on public.auth_login_attempts(attempt_key, created_at desc);
create index auth_login_attempts_cleanup_idx on public.auth_login_attempts(created_at);

alter table public.reserved_usernames enable row level security;
alter table public.reserved_usernames force row level security;
alter table public.username_history enable row level security;
alter table public.username_history force row level security;
alter table public.auth_login_attempts enable row level security;
alter table public.auth_login_attempts force row level security;
revoke all on public.reserved_usernames, public.username_history, public.auth_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.reserved_usernames, public.username_history, public.auth_login_attempts to service_role;
grant usage, select on sequence public.auth_login_attempts_id_seq to service_role;

create or replace function public.provision_invited_profile_v2(
  p_id uuid, p_email text, p_name text, p_role public.crm_role, p_username text, p_actor uuid
) returns void language plpgsql security definer set search_path = pg_catalog as $$
declare v_username text := nullif(btrim(p_username), '');
declare v_canonical text := nullif(private.canonical_username(p_username), '');
begin
  if p_role = 'owner' then raise exception 'owner invitation is forbidden'; end if;
  if not exists (select 1 from public.profiles where id=p_actor and active and role in ('owner','admin')) then raise exception 'actor is not authorized'; end if;
  if v_username is not null and not exists (select 1 from public.profiles where id=p_actor and active and role='owner') then raise exception 'owner required for username'; end if;
  if v_username is not null and (length(v_username) not between 3 and 32 or v_canonical !~ '^[a-z0-9](?:[a-z0-9._]{1,30}[a-z0-9])$' or v_canonical ~ '[._]{2}') then raise exception 'invalid username'; end if;
  if v_canonical is not null and (exists(select 1 from public.reserved_usernames where username_canonical=v_canonical) or exists(select 1 from public.username_history where username_canonical=v_canonical and (permanently_reserved or reserved_until>now()))) then raise exception 'username unavailable' using errcode='23505'; end if;
  insert into public.profiles(id,name,email,role,active,invitation_status,invited_at,invited_by,username,username_canonical)
  values(p_id,btrim(p_name),lower(btrim(p_email)),p_role,true,'sent',now(),p_actor,v_username,v_canonical);
  insert into public.activity_logs(firebase_id,entity_type,entity_id,actor_id,target_user_id,action,title,description,after_data,created_at)
  values('supabase:'||gen_random_uuid()::text,'user',p_id::text,p_actor,p_id,'user_invited','Usuario invitado','Invitación de acceso preparada.',jsonb_build_object('role',p_role,'username',v_canonical),now());
end; $$;

create or replace function public.admin_update_profile(p_target uuid, p_changes jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare target public.profiles%rowtype;
declare v_username text;
declare v_canonical text;
begin
  if not exists (select 1 from public.profiles where id=p_actor and active and role in ('owner','admin')) then raise exception 'actor is not authorized'; end if;
  if p_changes - array['name','role','active','username'] <> '{}'::jsonb then raise exception 'unsupported profile change'; end if;
  select * into target from public.profiles where id=p_target for update;
  if target.id is null then raise exception 'profile not found'; end if;
  if target.role='owner' and (p_changes ? 'role' or p_changes ? 'active' or p_changes ? 'name') then raise exception 'owner cannot be changed'; end if;
  if p_target=p_actor and (p_changes ? 'role' or (p_changes ? 'active' and not (p_changes->>'active')::boolean)) then raise exception 'self lockout forbidden'; end if;
  if p_changes ? 'role' and (p_changes->>'role') not in ('admin','manager','viewer','sales_agent') then raise exception 'role is not manageable'; end if;
  if p_changes ? 'username' then
    if not exists(select 1 from public.profiles where id=p_actor and active and role='owner') then raise exception 'owner required for username'; end if;
    v_username := nullif(btrim(p_changes->>'username'), '');
    v_canonical := nullif(private.canonical_username(v_username), '');
    if v_username is not null and (length(v_username) not between 3 and 32 or v_canonical !~ '^[a-z0-9](?:[a-z0-9._]{1,30}[a-z0-9])$' or v_canonical ~ '[._]{2}') then raise exception 'invalid username'; end if;
    if v_canonical is not null and v_canonical is distinct from target.username_canonical and (
      exists(select 1 from public.reserved_usernames where username_canonical=v_canonical)
      or exists(select 1 from public.username_history where username_canonical=v_canonical and (permanently_reserved or reserved_until>now()))
    ) then raise exception 'username unavailable' using errcode='23505'; end if;
    if target.username_canonical is not null and target.username_canonical is distinct from v_canonical then
      insert into public.username_history(profile_id,username,username_canonical,reserved_until,permanently_reserved,changed_by)
      values(target.id,target.username,target.username_canonical,case when target.role in ('owner','admin') then null else now()+interval '180 days' end,target.role in ('owner','admin'),p_actor);
    end if;
  end if;
  update public.profiles set
    name=case when p_changes ? 'name' then btrim(p_changes->>'name') else name end,
    role=case when p_changes ? 'role' then (p_changes->>'role')::public.crm_role else role end,
    active=case when p_changes ? 'active' then (p_changes->>'active')::boolean else active end,
    username=case when p_changes ? 'username' then v_username else username end,
    username_canonical=case when p_changes ? 'username' then v_canonical else username_canonical end
  where id=p_target;
  insert into public.activity_logs(firebase_id,entity_type,entity_id,actor_id,target_user_id,action,title,description,before_data,after_data,created_at)
  values(
    'supabase:'||gen_random_uuid()::text,
    'user',
    p_target::text,
    p_actor,
    p_target,
    'user_updated',
    'Usuario actualizado',
    'Perfil actualizado de forma segura.',
    jsonb_build_object('role',target.role,'active',target.active,'username',target.username_canonical),
    case when p_changes ? 'username' then (p_changes - 'username') || jsonb_build_object('username',v_canonical) else p_changes end,
    now()
  );
end; $$;

revoke all on function public.provision_invited_profile_v2(uuid,text,text,public.crm_role,text,uuid) from public,anon,authenticated;
grant execute on function public.provision_invited_profile_v2(uuid,text,text,public.crm_role,text,uuid) to service_role;
