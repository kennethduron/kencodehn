\set ON_ERROR_STOP on

do $$
declare
  violations bigint;
begin
  select count(*) into violations
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where n.nspname in ('public', 'private')
     and c.contype = 'f'
     and not c.convalidated;
  if violations <> 0 then raise exception 'restore has unvalidated foreign keys'; end if;

  select count(*) into violations
    from (values
      ('profiles'), ('clients'), ('projects'), ('receivables'), ('payments'),
      ('payment_allocations'), ('expenses'), ('project_add_ons'), ('add_on_proposals'),
      ('mail_identities'), ('mail_identity_assignments'), ('mail_threads'), ('mail_messages'),
      ('mail_attachments'), ('mail_drafts'), ('mail_read_states'), ('mail_webhook_events')
    ) expected(table_name)
    left join pg_class c on c.relname = expected.table_name
    left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where c.oid is null or not c.relrowsecurity or not c.relforcerowsecurity;
  if violations <> 0 then raise exception 'restore is missing required ENABLE/FORCE RLS'; end if;

  select count(*) into violations from public.receivables where balance_minor < 0 or amount_paid_minor < 0;
  if violations <> 0 then raise exception 'negative receivable balance after restore'; end if;

  select count(*) into violations
    from public.payment_allocations a
    join public.payments p on p.id = a.payment_id
    join public.receivables r on r.id = a.receivable_id
   where p.client_id <> r.client_id;
  if violations <> 0 then raise exception 'cross-client allocation after restore'; end if;

  select count(*) into violations from (
    select currency from public.projects
    union all select currency from public.receivables
    union all select currency from public.payments
    union all select currency from public.expenses
    union all select currency from public.project_add_ons
    union all select currency from public.add_on_proposals
  ) money where currency <> 'USD';
  if violations <> 0 then raise exception 'non-USD business row after restore'; end if;

  select count(*) into violations
    from public.mail_messages m left join public.mail_threads t on t.id = m.thread_id
   where t.id is null;
  if violations <> 0 then raise exception 'orphan mail message after restore'; end if;

  select count(*) into violations
    from public.mail_identity_assignments a
    left join public.mail_identities i on i.id = a.identity_id
    left join public.profiles p on p.id = a.profile_id
   where i.id is null or p.id is null;
  if violations <> 0 then raise exception 'orphan mail identity assignment after restore'; end if;

  select count(*) into violations
    from public.mail_identities i
   where i.status = 'active'
     and not exists (
       select 1 from public.mail_identity_assignments a
        where a.identity_id = i.id and a.active and a.is_primary
     );
  if violations <> 0 then raise exception 'active identity has no primary assignment after restore'; end if;
end
$$;

select jsonb_build_object(
  'status', 'PASS',
  'profiles', (select count(*) from public.profiles),
  'active_owners', (select count(*) from public.profiles where active and role = 'owner'),
  'clients', (select count(*) from public.clients),
  'projects', (select count(*) from public.projects),
  'receivables', (select count(*) from public.receivables),
  'payments', (select count(*) from public.payments),
  'allocations', (select count(*) from public.payment_allocations),
  'expenses', (select count(*) from public.expenses),
  'project_total_minor', coalesce((select sum(total_amount_minor) from public.projects), 0),
  'add_on_sales_minor', coalesce((select sum(accepted_amount_minor) from public.add_on_sales), 0),
  'receivable_balance_minor', coalesce((select sum(balance_minor) from public.receivables), 0),
  'payment_total_minor', coalesce((select sum(amount_minor) from public.payments where status = 'posted'), 0),
  'expense_total_minor', coalesce((select sum(amount_minor) from public.expenses where status = 'posted'), 0),
  'mail_identities', (select count(*) from public.mail_identities),
  'active_primary_assignments', (select count(*) from public.mail_identity_assignments where active and is_primary),
  'mail_threads', (select count(*) from public.mail_threads),
  'mail_messages', (select count(*) from public.mail_messages),
  'mail_attachments', (select count(*) from public.mail_attachments),
  'private_functions', (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private'
  )
) as phase6_restore_validation;

