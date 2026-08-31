-- Public contact submissions: persistent idempotency, scoped CRM notifications,
-- and exact lead deep links. Existing lead history remains unchanged.

alter table public.leads
  add column if not exists public_submission_key uuid;

create unique index if not exists leads_public_submission_key_unique
  on public.leads(public_submission_key)
  where public_submission_key is not null;

create or replace function public.create_public_lead(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_id uuid := gen_random_uuid();
  v_submission_key uuid;
  v_event uuid := gen_random_uuid();
  v_source_path text;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or length(btrim(coalesce(p_payload->>'name', ''))) not between 2 and 120
     or length(btrim(coalesce(p_payload->>'email', ''))) not between 5 and 180
     or btrim(coalesce(p_payload->>'email', '')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(btrim(coalesce(p_payload->>'phone', ''))) not between 8 and 40
     or length(btrim(coalesce(p_payload->>'message', ''))) not between 3 and 2000
     or nullif(p_payload->>'submissionId', '') is null then
    raise exception 'invalid public lead payload' using errcode = '22023';
  end if;

  begin
    v_submission_key := (p_payload->>'submissionId')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid public lead submission' using errcode = '22023';
  end;

  v_source_path := case p_payload->>'sourcePath'
    when '/contacto' then '/contacto'
    when '/en/contact' then '/en/contact'
    when '/cotizar' then '/cotizar'
    when '/en/quote' then '/en/quote'
    else '/contacto'
  end;

  insert into public.leads(
    id, firebase_id, public_submission_key, name, business, email, phone,
    project, budget, message, locale, status, priority, source, source_path,
    metadata, tags, created_at, updated_at
  ) values (
    v_id, 'supabase:' || v_id::text, v_submission_key,
    btrim(p_payload->>'name'), coalesce(p_payload->>'business', ''),
    lower(btrim(p_payload->>'email')), btrim(p_payload->>'phone'),
    coalesce(p_payload->>'project', ''), coalesce(p_payload->>'budget', ''),
    btrim(p_payload->>'message'),
    case when p_payload->>'locale' = 'en' then 'en' else 'es' end,
    'new', 'medium', 'public_website', v_source_path,
    coalesce(p_payload->'metadata', '{}'::jsonb),
    array[case when p_payload->>'locale' = 'en' then 'en' else 'es' end, coalesce(p_payload->>'project', '')],
    coalesce(nullif(p_payload->>'createdAt', '')::timestamptz, now()),
    coalesce(nullif(p_payload->>'updatedAt', '')::timestamptz, now())
  )
  on conflict (public_submission_key) where public_submission_key is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.leads
    where public_submission_key = v_submission_key;
    return v_id;
  end if;

  if coalesce((select internal_notifications_enabled from public.admin_settings where id = 'default'), true) then
    insert into public.notifications(
      id, firebase_id, recipient_id, recipient_name, recipient_email, lead_id,
      type, severity, title, message, action_url, is_read, created_at, updated_at
    )
    select
      gen_random_uuid(), 'public-lead:' || v_id::text || ':' || p.id::text,
      p.id, coalesce(p.display_name, p.name, p.email), p.email, v_id,
      'lead_new', 'success', 'Nueva solicitud desde el sitio web',
      case
        when nullif(btrim(coalesce(p_payload->>'business', '')), '') is null
          then btrim(p_payload->>'name') || ' envió una nueva solicitud.'
        else btrim(p_payload->>'name') || ' · ' || btrim(p_payload->>'business') || ' envió una nueva solicitud.'
      end,
      '/admin/leads/' || v_id::text, false, now(), now()
    from public.profiles p
    left join public.user_notification_preferences pref on pref.profile_id = p.id
    where p.active = true
      and p.role in ('owner', 'admin', 'manager', 'viewer')
      and coalesce(pref.internal_enabled, true)
      and coalesce(pref.event_preferences #>> '{proposal_activity,crm}', 'true') = 'true';
  end if;

  insert into public.activity_logs(
    id, firebase_id, entity_type, entity_id, lead_id, actor_firebase_uid,
    actor_email, action, title, description, after_data, created_at
  ) values (
    v_event, 'supabase:' || v_event::text, 'lead', v_id::text, v_id,
    'system', 'system', 'lead_created', 'Solicitud web recibida',
    'Se recibió una solicitud desde el formulario público.',
    jsonb_build_object('source', 'public_website', 'sourcePage', v_source_path), now()
  );

  return v_id;
end;
$$;

revoke all on function public.create_public_lead(jsonb) from public, anon, authenticated;
grant execute on function public.create_public_lead(jsonb) to service_role;

drop policy if exists notifications_read_scoped on public.notifications;
create policy notifications_read_scoped on public.notifications
for select to authenticated
using (
  private.current_profile_active()
  and (recipient_id = auth.uid() or (private.is_operations_admin() and recipient_id is null))
);

drop policy if exists notifications_update_scoped on public.notifications;
create policy notifications_update_scoped on public.notifications
for update to authenticated
using (
  private.current_profile_active()
  and (recipient_id = auth.uid() or (private.is_operations_admin() and recipient_id is null))
)
with check (
  private.current_profile_active()
  and (recipient_id = auth.uid() or (private.is_operations_admin() and recipient_id is null))
);

drop policy if exists notifications_delete_scoped on public.notifications;
create policy notifications_delete_scoped on public.notifications
for delete to authenticated
using (
  private.current_profile_active()
  and (recipient_id = auth.uid() or (private.is_operations_admin() and recipient_id is null))
);

comment on column public.leads.public_submission_key is
  'Opaque browser-generated key used only to make accidental retries idempotent; a new inquiry receives a new key.';
comment on function public.create_public_lead(jsonb) is
  'Service-only atomic public lead creation with persistent retry deduplication and recipient-scoped internal notifications.';
