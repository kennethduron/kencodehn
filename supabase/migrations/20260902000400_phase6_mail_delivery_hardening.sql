-- Phase 6: durable outbound delivery states without weakening message immutability.
alter type public.mail_delivery_status add value if not exists 'delayed';
alter type public.mail_delivery_status add value if not exists 'delivered';
alter type public.mail_delivery_status add value if not exists 'bounced';
alter type public.mail_delivery_status add value if not exists 'complained';

alter table public.mail_messages
  add column delivery_status_at timestamptz;

-- Phase 5 intentionally rejects every UPDATE/DELETE. Suspend only that named
-- trigger for this one transactional metadata backfill, then restore it before
-- replacing the trigger function with the narrower service-role exception.
alter table public.mail_messages disable trigger mail_messages_immutable;

update public.mail_messages
set delivery_status_at = coalesce(received_at, sent_at, created_at)
where delivery_status_at is null;

alter table public.mail_messages enable trigger mail_messages_immutable;

alter table public.mail_messages
  alter column delivery_status_at set default now(),
  alter column delivery_status_at set not null;

create or replace function private.prevent_mail_message_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and auth.role() = 'service_role'
     and (to_jsonb(new) - array['delivery_status','delivery_status_at','provider_event_id'])
       = (to_jsonb(old) - array['delivery_status','delivery_status_at','provider_event_id']) then
    return new;
  end if;
  raise exception 'delivered messages are immutable' using errcode = '42501';
end
$$;

create or replace function public.apply_mail_delivery_event(
  p_provider_email_id text,
  p_provider_event_id text,
  p_status public.mail_delivery_status,
  p_occurred_at timestamptz
)
returns table(message_id uuid, thread_id uuid, identity_id uuid, applied boolean)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_message public.mail_messages%rowtype;
  v_applied boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_status not in ('sent','delayed','delivered','failed','bounced','complained') then
    raise exception 'unsupported outbound mail status' using errcode = '22023';
  end if;

  select * into v_message
  from public.mail_messages
  where provider_email_id = p_provider_email_id
    and direction = 'outbound'
  for update;

  if not found then
    return;
  end if;

  if p_occurred_at >= v_message.delivery_status_at then
    update public.mail_messages
    set delivery_status = p_status,
        delivery_status_at = p_occurred_at,
        provider_event_id = p_provider_event_id
    where id = v_message.id;
    v_applied := true;
  end if;

  return query select v_message.id, v_message.thread_id, v_message.sender_identity_id, v_applied;
end
$$;

revoke all on function public.apply_mail_delivery_event(text,text,public.mail_delivery_status,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_mail_delivery_event(text,text,public.mail_delivery_status,timestamptz) to service_role;

comment on function public.apply_mail_delivery_event(text,text,public.mail_delivery_status,timestamptz)
is 'Applies signed Resend outbound delivery events in provider timestamp order without permitting message content mutation.';

-- Phase 5 added mail notifications but accidentally replaced the financial
-- notification values introduced in Phase 2. Preserve the authoritative union.
alter table public.notifications drop constraint if exists notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in (
  'lead', 'task', 'lead_new', 'lead_status_changed', 'lead_priority_changed',
  'note_added', 'task_created', 'task_updated', 'task_completed',
  'task_reminder', 'task_due', 'task_overdue', 'system',
  'payment_due_7_days', 'payment_due_3_days', 'payment_due_today',
  'payment_overdue', 'payment_received', 'module',
  'mail_received', 'mail_assigned', 'mail_follow_up'
));

create or replace function public.billing_dashboard_summary(
  p_today date default (timezone('America/Tegucigalpa', now()))::date
)
returns table(
  currency text,
  due_today_minor bigint,
  next_7_days_minor bigint,
  overdue_minor bigint,
  outstanding_minor bigint,
  collected_month_minor bigint
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with receivable_totals as (
    select
      coalesce(sum(r.balance_minor) filter (where r.payment_state <> 'cancelled'), 0)::bigint as outstanding_minor,
      coalesce(sum(r.balance_minor) filter (where r.payment_state in ('open','partially_paid') and r.due_date = p_today), 0)::bigint as due_today_minor,
      coalesce(sum(r.balance_minor) filter (where r.payment_state in ('open','partially_paid') and r.due_date > p_today and r.due_date <= p_today + 7), 0)::bigint as next_7_days_minor,
      coalesce(sum(r.balance_minor) filter (where r.payment_state in ('open','partially_paid') and r.due_date < p_today), 0)::bigint as overdue_minor
    from public.receivables r
    where r.currency = 'USD'
  ), payment_totals as (
    select coalesce(sum(p.amount_minor), 0)::bigint as collected_month_minor
    from public.payments p
    where p.currency = 'USD'
      and p.status = 'posted'
      and (p.paid_at at time zone 'America/Tegucigalpa')::date >= date_trunc('month', p_today)::date
      and (p.paid_at at time zone 'America/Tegucigalpa')::date < (date_trunc('month', p_today) + interval '1 month')::date
  )
  select 'USD'::text, r.due_today_minor, r.next_7_days_minor, r.overdue_minor,
    r.outstanding_minor, p.collected_month_minor
  from receivable_totals r cross join payment_totals p
$$;

revoke all on function public.billing_dashboard_summary(date) from public, anon;
grant execute on function public.billing_dashboard_summary(date) to authenticated;

comment on function public.billing_dashboard_summary(date)
is 'RLS-aware USD billing aggregates computed in PostgreSQL; avoids transferring unbounded financial rows to the application.';
