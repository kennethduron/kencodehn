\set ON_ERROR_STOP on
set synchronous_commit = off;

do $$
begin
  if not exists (select 1 from public.profiles where active and role = 'owner') then
    raise exception 'Phase 6 scale fixture requires a local active Owner fixture.';
  end if;
  if not exists (select 1 from public.mail_identities where status = 'active') then
    raise exception 'Phase 6 scale fixture requires a local active mail identity fixture.';
  end if;
end
$$;

insert into public.clients(id,name,company,email,status,client_since,assigned_to,assigned_at,assigned_by,created_by,metadata)
select md5('p6-client-'||g)::uuid,
  'Cliente de carga '||lpad(g::text,4,'0'),
  'Empresa sanitizada '||g,
  'scale-'||g||'@example.test',
  'active', current_date,
  owner.id, now(), owner.id, owner.id,
  jsonb_build_object('fixture','phase6-scale')
from generate_series(1,1000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.projects(id,client_id,name,status,total_amount_minor,currency,sold_at,effective_date,assigned_to,assigned_at,assigned_by,created_by,metadata)
select md5('p6-project-'||g)::uuid,
  md5('p6-client-'||(((g-1)%1000)+1))::uuid,
  'Proyecto de carga '||lpad(g::text,4,'0'),
  'active', 100000 + g, 'USD', current_date, current_date,
  owner.id, now(), owner.id, owner.id,
  jsonb_build_object('fixture','phase6-scale')
from generate_series(1,3000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.project_add_ons(id,project_id,client_id,name,description,request_date,currency,assigned_sales_agent_id,created_by,notes)
select md5('p6-addon-'||g)::uuid,
  md5('p6-project-'||g)::uuid,
  md5('p6-client-'||(((g-1)%1000)+1))::uuid,
  'Modulo de carga '||lpad(g::text,4,'0'),
  'Fixture local sanitizado', current_date, 'USD', owner.id, owner.id, 'phase6-scale'
from generate_series(1,3000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.project_recurring_services(id,project_id,name,monthly_amount_minor,currency,frequency,start_date,billing_day,billing_time,timezone,status,created_by,updated_by)
select md5('p6-recurring-'||g)::uuid,
  md5('p6-project-'||g)::uuid,
  'Servicio recurrente de carga '||g,
  10000 + g, 'USD', 'monthly', current_date, ((g-1)%28)+1, '09:00', 'America/Tegucigalpa', 'active', owner.id, owner.id
from generate_series(1,3000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.receivables(id,client_id,project_id,origin_type,recurring_service_id,recurring_period_key,description,amount_due_minor,amount_paid_minor,currency,due_date,due_time,due_timezone,payment_state,created_by,metadata)
select md5('p6-receivable-'||g)::uuid,
  md5('p6-client-'||((((g-1)%3000)%1000)+1))::uuid,
  md5('p6-project-'||(((g-1)%3000)+1))::uuid,
  'recurring_service',
  md5('p6-recurring-'||(((g-1)%3000)+1))::uuid,
  to_char(date '2026-01-01' + (((g-1)/3000)::int * interval '1 month'),'YYYY-MM'),
  'Cuenta local de carga '||g,
  10000 + (g%5000), 0, 'USD', current_date + ((g%90)-45), '09:00', 'America/Tegucigalpa', 'open', owner.id,
  jsonb_build_object('fixture','phase6-scale')
from generate_series(1,12000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.payments(id,client_id,currency,amount_minor,paid_at,method,reference,notes,status,recorded_by,notify_client,metadata)
select md5('p6-payment-'||g)::uuid,
  md5('p6-client-'||(((g-1)%1000)+1))::uuid,
  'USD', 5000 + (g%2500), now() - ((g%365)||' days')::interval,
  'bank_transfer', 'SCALE-'||g, 'Fixture local sanitizado', 'posted', owner.id, false,
  jsonb_build_object('fixture','phase6-scale')
from generate_series(1,12000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.activity_logs(id,firebase_id,entity_type,entity_id,client_id,actor_id,actor_email,recipient_id,action,title,description,after_data,metadata,created_at)
select md5('p6-activity-'||g)::uuid,
  'phase6-scale:'||g, 'client', md5('p6-client-'||(((g-1)%1000)+1))::uuid::text,
  md5('p6-client-'||(((g-1)%1000)+1))::uuid,
  owner.id, 'scale-owner@example.test', owner.id,
  'scale_observation', 'Actividad de carga', 'Fixture local sanitizado',
  jsonb_build_object('sequence',g), jsonb_build_object('fixture','phase6-scale'), now() - ((g%90)||' days')::interval
from generate_series(1,12000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
on conflict(id) do nothing;

insert into public.mail_threads(id,identity_id,subject,state,assigned_to,snippet,latest_message_at,created_by)
select md5('p6-thread-'||g)::uuid, identity.id,
  'Conversacion de carga '||lpad(g::text,4,'0'), 'inbox', owner.id,
  'Contenido local sanitizado para validar paginacion y busqueda.', now() - ((g%30)||' days')::interval, owner.id
from generate_series(1,4000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
cross join lateral (select id from public.mail_identities where status='active' order by created_at limit 1) identity
on conflict(id) do nothing;

insert into public.mail_messages(id,thread_id,direction,delivery_status,provider_email_id,message_id,from_address,to_addresses,subject,body_html,body_text,sent_by,sender_identity_id,sender_snapshot,sent_at,received_at,created_at)
select md5('p6-message-'||g)::uuid,
  md5('p6-thread-'||(((g-1)%4000)+1))::uuid,
  case when g<=4000 then 'outbound'::public.mail_direction else 'inbound'::public.mail_direction end,
  case when g<=4000 then 'delivered'::public.mail_delivery_status else 'received'::public.mail_delivery_status end,
  'phase6-scale-email-'||g,
  '<phase6-scale-'||g||'@example.test>',
  case when g<=4000 then jsonb_build_object('email',identity.email,'name','Ken Code Local') else jsonb_build_object('email','external-'||g||'@example.test') end,
  case when g<=4000 then jsonb_build_array(jsonb_build_object('email','external-'||g||'@example.test')) else jsonb_build_array(jsonb_build_object('email',identity.email)) end,
  'Conversacion de carga '||(((g-1)%4000)+1), '<p>Contenido local sanitizado.</p>', 'Contenido local sanitizado.',
  case when g<=4000 then owner.id else null end,
  case when g<=4000 then identity.id else null end,
  case when g<=4000 then jsonb_build_object('userId',owner.id,'identity',identity.email) else '{}'::jsonb end,
  case when g<=4000 then now() - ((g%30)||' days')::interval else null end,
  case when g>4000 then now() - ((g%30)||' days')::interval else null end,
  now() - ((g%30)||' days')::interval
from generate_series(1,8000) g
cross join lateral (select id from public.profiles where active and role='owner' order by created_at limit 1) owner
cross join lateral (select id,email from public.mail_identities where status='active' order by created_at limit 1) identity
on conflict(id) do nothing;

analyze public.clients;
analyze public.projects;
analyze public.project_add_ons;
analyze public.receivables;
analyze public.payments;
analyze public.activity_logs;
analyze public.mail_threads;
analyze public.mail_messages;

select 'counts' as check_name,
  (select count(*) from public.clients where metadata->>'fixture'='phase6-scale') as clients,
  (select count(*) from public.projects where metadata->>'fixture'='phase6-scale') as projects,
  (select count(*) from public.project_add_ons where notes='phase6-scale') as modules,
  (select count(*) from public.receivables where metadata->>'fixture'='phase6-scale') as receivables,
  (select count(*) from public.payments where metadata->>'fixture'='phase6-scale') as payments,
  (select count(*) from public.activity_logs where metadata->>'fixture'='phase6-scale') as activities,
  (select count(*) from public.mail_threads where subject like 'Conversacion de carga %') as mail_threads,
  (select count(*) from public.mail_messages where provider_email_id like 'phase6-scale-email-%') as mail_messages;

explain (analyze,buffers,costs off)
select id,name,company,status,updated_at from public.clients
where status='active' order by updated_at desc,id limit 25;

explain (analyze,buffers,costs off)
select id,name,status,total_amount_minor from public.projects
where client_id=md5('p6-client-500')::uuid order by updated_at desc limit 25;

explain (analyze,buffers,costs off)
select id,due_date,balance_minor,payment_state from public.receivables
where payment_state in ('open','partially_paid') order by due_at,id limit 25;

explain (analyze,buffers,costs off)
select id,amount_minor,paid_at,status from public.payments
where client_id=md5('p6-client-500')::uuid order by paid_at desc limit 25;

explain (analyze,buffers,costs off)
select id,name,commercial_status,work_status from public.project_add_ons
where assigned_sales_agent_id=(select id from public.profiles where active and role='owner' order by created_at limit 1)
order by updated_at desc limit 25;

explain (analyze,buffers,costs off)
select id,subject,snippet,latest_message_at from public.mail_threads
where state='inbox' and identity_id=(select id from public.mail_identities where status='active' order by created_at limit 1)
order by latest_message_at desc,id limit 26;
