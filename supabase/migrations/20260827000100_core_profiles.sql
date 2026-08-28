-- Ken Code M1: identity foundation and resumable migration tracking.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.crm_role as enum (
  'owner',
  'admin',
  'manager',
  'viewer',
  'sales_agent'
);

create type public.invitation_status as enum (
  'pending',
  'sent',
  'failed',
  'accepted'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  firebase_id text unique,
  firebase_uid text unique,
  name text not null default '',
  email text not null,
  role public.crm_role not null,
  active boolean not null default true,
  invitation_status public.invitation_status,
  invited_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  invitation_last_sent_at timestamptz,
  invitation_error text,
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint profiles_firebase_uid_nonempty check (firebase_uid is null or length(btrim(firebase_uid)) between 1 and 160),
  constraint profiles_firebase_id_nonempty check (firebase_id is null or length(btrim(firebase_id)) between 1 and 500)
);

create index profiles_role_active_idx on public.profiles (role, active);
create index profiles_email_idx on public.profiles (email);

create table public.migration_id_map (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_collection text not null,
  source_id text not null,
  target_table text not null,
  target_id text not null,
  source_version text not null default 'firebase-v1',
  checksum text not null,
  migrated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint migration_id_map_source_nonempty check (
    length(btrim(source_system)) > 0
    and length(btrim(source_collection)) > 0
    and length(btrim(source_id)) > 0
    and length(btrim(target_table)) > 0
    and length(btrim(target_id)) > 0
    and length(btrim(checksum)) > 0
  ),
  unique (source_system, source_collection, source_id, target_table)
);

create index migration_id_map_target_idx on public.migration_id_map (target_table, target_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

comment on table public.profiles is 'Application profile keyed by Supabase auth.users UUID; Firebase UID is migration metadata only.';
comment on table public.migration_id_map is 'Idempotent Firebase-to-Supabase migration mapping; never exposed to browser roles.';
