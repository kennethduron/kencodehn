-- Phase 5: self-service profile data and private user avatars.
alter table public.profiles
  add column if not exists display_name text not null default '',
  add column if not exists preferred_name text not null default '',
  add column if not exists job_title text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists profile_photo_path text,
  add column if not exists locale text not null default 'es-HN';
alter table public.profiles add constraint profiles_display_name_length check(length(display_name)<=160);
alter table public.profiles add constraint profiles_preferred_name_length check(length(preferred_name)<=100);
alter table public.profiles add constraint profiles_job_title_length check(length(job_title)<=140);
alter table public.profiles add constraint profiles_phone_length check(length(phone)<=60);
alter table public.profiles add constraint profiles_locale_valid check(locale in ('es-HN','en-US'));
alter table public.profiles add constraint profiles_photo_path_safe check(profile_photo_path is null or profile_photo_path ~ ('^'||id::text||'/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists profile_photos_select on storage.objects;
create policy profile_photos_select on storage.objects for select to authenticated
using(bucket_id='profile-photos' and private.current_profile_active() and ((storage.foldername(name))[1]=auth.uid()::text or private.current_profile_role() in ('owner','admin','manager')));
create or replace function public.update_own_profile(p_changes jsonb)
returns public.profiles language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_profile public.profiles;
begin
  if not private.current_profile_active() then raise exception 'profile inactive' using errcode='42501'; end if;
  if jsonb_typeof(p_changes)<>'object' or p_changes-array['displayName','preferredName','jobTitle','phone','locale','profilePhotoPath']<>'{}'::jsonb then raise exception 'unsupported profile field' using errcode='22023'; end if;
  update public.profiles set
    display_name=case when p_changes?'displayName' then btrim(coalesce(p_changes->>'displayName','')) else display_name end,
    preferred_name=case when p_changes?'preferredName' then btrim(coalesce(p_changes->>'preferredName','')) else preferred_name end,
    job_title=case when p_changes?'jobTitle' then btrim(coalesce(p_changes->>'jobTitle','')) else job_title end,
    phone=case when p_changes?'phone' then btrim(coalesce(p_changes->>'phone','')) else phone end,
    locale=case when p_changes?'locale' then coalesce(nullif(p_changes->>'locale',''),'es-HN') else locale end,
    profile_photo_path=case when p_changes?'profilePhotoPath' then nullif(p_changes->>'profilePhotoPath','') else profile_photo_path end
  where id=auth.uid() returning * into v_profile;
  if not found then raise exception 'profile not found' using errcode='P0002'; end if;
  return v_profile;
end; $$;
revoke all on function public.update_own_profile(jsonb) from public,anon;
grant execute on function public.update_own_profile(jsonb) to authenticated;
