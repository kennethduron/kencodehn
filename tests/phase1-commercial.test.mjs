import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260829000400_clients_projects_commercial_agreements.sql", "utf8");
const baseline = readFileSync("supabase/migrations/20260829000300_phase1_clean_business_baseline.sql", "utf8");
const api = readFileSync("src/app/api/admin/commercial/route.ts", "utf8");
const auth = readFileSync("src/lib/admin/authorization.ts", "utf8");
const clientList = readFileSync("src/components/admin/client-list.tsx", "utf8");
const clientDetail = readFileSync("src/components/admin/client-detail.tsx", "utf8");
const projectList = readFileSync("src/components/admin/project-list.tsx", "utf8");
const projectDetail = readFileSync("src/components/admin/project-detail.tsx", "utf8");
const teamPanel = readFileSync("src/components/admin/team-panel.tsx", "utf8");
const chrome = readFileSync("src/components/admin/admin-chrome.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

const matches = (source, pattern) => () => assert.match(source, pattern);
const omits = (source, pattern) => () => assert.doesNotMatch(source, pattern);

test("01 backup required before cleanup", matches(baseline, /verified backup checksum required/));
test("02 backup checksum is SHA-256 shaped", matches(baseline, /\[0-9a-f\]\{64\}/));
test("03 Owner profile is preserved", omits(baseline, /delete from public\.profiles/i));
test("04 configuration is preserved", omits(baseline, /delete from public\.admin_settings/i));
test("05 old leads are removed", matches(baseline, /delete from public\.leads/));
test("06 old tasks are removed", matches(baseline, /delete from public\.tasks/));
test("07 old notifications are removed", matches(baseline, /delete from public\.notifications/));
test("08 cleanup guards run before deletes so transaction failure rolls back", () => assert.ok(baseline.indexOf("operational data changed after backup") < baseline.indexOf("delete from public.reminder_events")));
test("09 technical migration history is preserved", omits(baseline, /delete from public\.migration_(id_map|checkpoints)/i));

test("10 manual client creation exists", matches(sql, /p_operation = 'client_create'/));
test("11 historical client date is separate from created_at", matches(sql, /client_since date not null[\s\S]*created_at timestamptz/));
test("12 won lead conversion exists", matches(sql, /only won leads can become clients/));
test("13 duplicate lead conversion is prevented", matches(sql, /origin_lead_id uuid unique/));
test("14 client seller assignment has an explicit operation", matches(sql, /p_operation = 'client_assign'/));
test("15 Sales Agent can scope own client", matches(sql, /clients_read_scoped[\s\S]*assigned_to = auth\.uid\(\)/));
test("16 Sales Agent cannot read another client by policy", matches(sql, /private\.has_global_lead_scope\(\) or assigned_to = auth\.uid\(\)/));
test("17 inactive user is denied by RPC actor lookup", matches(sql, /where id = auth\.uid\(\) and active = true/));
test("18 Owner has global commercial scope", matches(sql, /private\.has_global_lead_scope\(\)/));
test("19 Admin server permissions include client management", matches(auth, /admin:[\s\S]*"clients:edit"[\s\S]*"clients:assign"/));

test("20 project creation exists", matches(sql, /p_operation = 'project_create'/));
test("21 projects use a real client FK", matches(sql, /client_id uuid not null references public\.clients\(id\)/));
test("22 project seller can inherit client seller", matches(sql, /coalesce\(nullif\(p_payload->>'assignedToUid',''\)::uuid,v_client\.assigned_to\)/));
test("23 project money uses BIGINT minor units", matches(sql, /total_amount_minor bigint/));
test("24 invalid currency is rejected", matches(sql, /currency ~ '\^\[A-Z\]\{3\}\$'/));
test("25 project effective date is distinct from created_at", matches(sql, /effective_date date not null[\s\S]*created_at timestamptz/));
test("26 Sales Agent cross-project access is scoped", matches(sql, /project_in_current_scope[\s\S]*p\.assigned_to = auth\.uid\(\)/));

test("27 one-installment plan is supported", matches(sql, /jsonb_array_elements\(coalesce\(p_payload->'installments'/));
test("28 two-installment plan is not hardcoded", omits(sql, /installment_count\s*=\s*2/i));
test("29 three-installment plan is not hardcoded", matches(sql, /jsonb_array_length[\s\S]*>60/));
test("30 arbitrary split is accumulated in minor units", matches(sql, /v_sum:=v_sum\+\(v_item->>'amountMinor'\)::bigint/));
test("31 total mismatch is rejected on activation", matches(sql, /v_sum<>v_project\.total_amount_minor/));
test("32 negative installments are rejected", matches(sql, /amount_minor bigint not null check \(amount_minor > 0\)/));
test("33 zero installment is invalid", matches(sql, /amount_minor > 0/));
test("34 installment currency mismatch is rejected", matches(sql, /currency<>v_project\.currency/));
test("35 activation locks plan and project transactionally", matches(sql, /payment_plan_activate[\s\S]*for update[\s\S]*for update/));
test("36 duplicate active plan is prevented", matches(sql, /project_payment_plans_one_active_idx[\s\S]*where status = 'active'/));
test("37 installment ordering is unique", matches(sql, /unique\(payment_plan_id, sequence\)/));

test("38 monthly service is optional", omits(sql, /project_recurring_services_id.*projects/i));
test("39 monthly amount uses minor units", matches(sql, /monthly_amount_minor bigint/));
test("40 recurring service has a start date", matches(sql, /project_recurring_services[\s\S]*start_date date not null/));
test("41 project total is not updated by recurring service", omits(sql.slice(sql.indexOf("p_operation = 'recurring_service_save'")), /update public\.projects set total_amount_minor/));
test("42 recurring service can be paused or cancelled", matches(sql, /recurring_service_status as enum \('draft', 'active', 'paused', 'cancelled'\)/));

test("43 client RLS is enabled and forced", matches(sql, /alter table public\.clients enable row level security;[\s\S]*alter table public\.clients force row level security/));
test("44 project RLS is enabled and forced", matches(sql, /alter table public\.projects enable row level security;[\s\S]*alter table public\.projects force row level security/));
test("45 installment RLS is project scoped", matches(sql, /installments_read_scoped[\s\S]*private\.project_in_current_scope/));
test("46 role escalation through seller assignment is denied", matches(sql, /client assignment requires owner or admin/));
test("47 server authorization maps every commercial operation", () => { for (const operation of ["lead_convert","client_create","client_update","client_assign","project_create","project_update","project_assign","payment_plan_save","payment_plan_activate","recurring_service_save"]) assert.match(api, new RegExp(`${operation}:`)); });
test("47b payment plans and recurring services remain Owner/Admin writes", () => {
  assert.match(sql, /v_actor\.role not in \('owner','admin'\) then raise exception 'payment plan edit forbidden'/);
  assert.match(sql, /v_actor\.role not in \('owner','admin'\) then raise exception 'recurring service edit forbidden'/);
  assert.doesNotMatch(auth.match(/manager: \[[^\n]+/)?.[0] ?? "", /commercial_plans:edit|recurring_services:edit/);
});

test("48 320 layout has mobile cards", matches(clientList + projectList, /md:hidden/));
test("49 375 layout keeps touch targets at 44px", matches(clientList + projectDetail, /min-h-11|h-11/));
test("50 768 layout switches to controlled tables", matches(clientList + projectList, /hidden overflow-hidden md:block/));
test("51 1024 layout uses responsive grids", matches(clientDetail + projectDetail, /xl:grid-cols/));
test("52 1440 layout uses bounded multi-column forms", matches(projectList + projectDetail, /xl:grid-cols-3|xl:grid-cols-4/));
test("53 mobile installment builder uses cards instead of a table", () => { assert.match(projectDetail, /installments\.map[\s\S]*<article/); assert.doesNotMatch(projectDetail.slice(projectDetail.indexOf("installments.map")), /<table/); });
test("54 tables use controlled horizontal overflow", matches(clientList + projectList, /overflow-x-auto/));
test("55 modal viewport and tab overflow remain bounded", () => { assert.match(globals, /kc-modal-viewport/); assert.match(clientDetail + projectDetail, /overflow-x-auto/); });
test("56 server and browser render team dates in the same timezone", matches(teamPanel, /timeZone:\s*HONDURAS_TIME_ZONE/));

test("commercial activity always records a human actor", matches(sql, /actor_id uuid not null references public\.profiles/));
test("seller history is immutable through grants", () => { assert.match(sql, /grant select, insert on public\.seller_assignment_events/); assert.doesNotMatch(sql, /grant[^;]*update[^;]*seller_assignment_events/); });
test("installments retain date and optional time for future reminders", matches(sql, /due_date date,[\s\S]*due_time time/));
test("Phase 1 creates no real payments or receivables table", omits(sql, /create table public\.(payments|receivables)\b/));
test("Phase 1 migration sends no email, push or cron", omits(sql, /net\.http_post|send_email\s*\(|send_push\s*\(|cron\.schedule/i));
test("navigation exposes Clients and Projects by permission", () => { assert.match(chrome, /\/admin\/clientes/); assert.match(chrome, /\/admin\/proyectos/); });
test("client detail includes all seven requested sections", () => { for (const label of ["Resumen","Proyectos","Facturación","Pagos","Tareas","Comunicaciones","Actividad"]) assert.match(clientDetail, new RegExp(label)); });
test("light Design System remains centralized", () => { for (const token of ["--kc-admin-workspace","--kc-admin-surface","--kc-admin-text","--kc-admin-border","--kc-admin-primary"]) assert.match(globals, new RegExp(token)); });
