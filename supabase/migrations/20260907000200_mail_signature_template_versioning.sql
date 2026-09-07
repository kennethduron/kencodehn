-- Mail branding, immutable signature snapshots, and versioned corporate templates.
create table public.corporate_mail_signatures (
  id uuid primary key default gen_random_uuid(),
  logical_id uuid not null default gen_random_uuid(),
  version integer not null default 1,
  identity_id uuid references public.mail_identities(id) on delete restrict,
  name text not null,
  body_html text not null,
  logo_url text,
  active boolean not null default true,
  locked boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint corporate_signature_name_valid check(length(btrim(name)) between 2 and 120),
  constraint corporate_signature_body_limit check(length(body_html) between 1 and 50000),
  constraint corporate_signature_logo_https check(logo_url is null or logo_url ~ '^https://'),
  unique(logical_id,version)
);
create unique index corporate_mail_signature_active_scope_uq
  on public.corporate_mail_signatures(coalesce(identity_id,'00000000-0000-0000-0000-000000000000'::uuid)) where active;

alter table public.corporate_mail_signatures enable row level security;
alter table public.corporate_mail_signatures force row level security;
create policy corporate_mail_signatures_read on public.corporate_mail_signatures for select to authenticated
  using(private.current_profile_active() and active and private.current_profile_role() in ('owner','admin','manager','sales_agent'));
grant select on public.corporate_mail_signatures to authenticated;
grant select,insert,update on public.corporate_mail_signatures to service_role;

create or replace function public.publish_corporate_mail_signature(
  p_current uuid,p_identity uuid,p_name text,p_body_html text,p_logo_url text,p_actor uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_current public.corporate_mail_signatures%rowtype; v_logical uuid:=gen_random_uuid(); v_version integer:=1; v_new uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor and active and role='owner') then raise exception 'owner required' using errcode='42501'; end if;
  if p_identity is not null and not exists(select 1 from public.mail_identities where id=p_identity and status='active') then raise exception 'identity unavailable' using errcode='22023'; end if;
  if p_current is not null then
    select * into v_current from public.corporate_mail_signatures where id=p_current and active for update;
    if not found then raise exception 'signature version changed' using errcode='40001'; end if;
    v_logical:=v_current.logical_id; v_version:=v_current.version+1;
    update public.corporate_mail_signatures set active=false where id=v_current.id;
  end if;
  insert into public.corporate_mail_signatures(logical_id,version,identity_id,name,body_html,logo_url,active,locked,created_by)
  values(v_logical,v_version,p_identity,p_name,p_body_html,p_logo_url,true,true,p_actor) returning id into v_new;
  return jsonb_build_object('id',v_new,'version',v_version);
end; $$;
revoke all on function public.publish_corporate_mail_signature(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.publish_corporate_mail_signature(uuid,uuid,text,text,text,uuid) to service_role;

alter table public.mail_messages add column signature_snapshot jsonb not null default '{}'::jsonb;
alter table public.mail_drafts add column signature_selection text;
alter table public.mail_drafts add constraint mail_draft_signature_selection_safe check(signature_selection is null or signature_selection ~ '^(personal|corporate):[0-9a-f-]{36}$');
alter table public.mail_signatures add column logo_url text;
alter table public.mail_signatures add constraint mail_signature_logo_https check(logo_url is null or logo_url ~ '^https://');

alter table public.mail_templates
  add column logical_id uuid not null default gen_random_uuid(),
  add column version integer not null default 1,
  add column scope text not null default 'corporate',
  add column locked boolean not null default true,
  add column status text not null default 'published';
alter table public.mail_templates
  add constraint mail_template_scope_valid check(scope in ('corporate','team','personal')),
  add constraint mail_template_status_valid check(status in ('draft','published','retired')),
  add constraint mail_template_logical_version_uq unique(logical_id,version);

create or replace function public.publish_mail_template(
  p_current uuid,p_name text,p_subject text,p_body_html text,p_active boolean,p_actor uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_current public.mail_templates%rowtype; v_logical uuid:=gen_random_uuid(); v_version integer:=1; v_new uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor and active and role='owner') then raise exception 'owner required' using errcode='42501'; end if;
  if p_current is not null then
    select * into v_current from public.mail_templates where id=p_current for update;
    if not found then raise exception 'template version changed' using errcode='40001'; end if;
    v_logical:=v_current.logical_id; v_version:=v_current.version+1;
    update public.mail_templates set active=false,status='retired',updated_at=now(),updated_by=p_actor where id=v_current.id;
  end if;
  insert into public.mail_templates(logical_id,version,name,subject,body_html,active,locked,scope,status,created_by,updated_by)
  values(v_logical,v_version,p_name,p_subject,p_body_html,p_active,true,'corporate',case when p_active then 'published' else 'retired' end,p_actor,p_actor)
  returning id into v_new;
  return jsonb_build_object('id',v_new,'version',v_version);
end; $$;
revoke all on function public.publish_mail_template(uuid,text,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.publish_mail_template(uuid,text,text,text,boolean,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mail-signature-assets','mail-signature-assets',true,512000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
