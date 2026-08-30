import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260831000100_phase3_finance_expenses_reporting.sql", "utf8");
const usdSql = readFileSync("supabase/migrations/20260831000200_enforce_usd_business_currency.sql", "utf8");
const auth = readFileSync("src/lib/admin/authorization.ts", "utf8");
const data = readFileSync("src/lib/finance/data.ts", "utf8");
const api = readFileSync("src/app/api/admin/finance/route.ts", "utf8");
const exportRoute = readFileSync("src/app/api/admin/finance/export/route.ts", "utf8");
const dashboard = readFileSync("src/components/admin/finance-dashboard.tsx", "utf8");
const expense = readFileSync("src/components/admin/expense-panel.tsx", "utf8");
const reports = readFileSync("src/components/admin/finance-report-table.tsx", "utf8");
const all = sql + usdSql + auth + data + api + exportRoute + dashboard + expense + reports;

const cases = [
  ["F01 expense categories table", /create table public\.expense_categories/],
  ["F02 expenses table", /create table public\.expenses/],
  ["F03 UUID primary key", /id uuid primary key default gen_random_uuid/],
  ["F04 amount uses bigint", /amount_minor bigint not null/],
  ["F05 positive amount", /expenses_amount_positive check \(amount_minor > 0\)/],
  ["F06 ISO currency field preserved", /expenses_currency_iso check/],
  ["F07 USD accepted and defaulted", /alter table public\.expenses alter column currency set default 'USD'/],
  ["F08 HNL rejected by database boundary", /new\.currency is distinct from 'USD'/],
  ["F09 project is optional", /project_id uuid references/],
  ["F10 posted status", /expense_status as enum \('posted', 'reversed'\)/],
  ["F11 reversal consistency", /expenses_reversal_consistent/],
  ["F12 hard delete blocked", /expenses_no_delete/],
  ["F13 category names unique", /expense_categories_name_unique_idx/],
  ["F14 category seed is configuration", /\('Software'/],
  ["F15 date index", /expenses_date_currency_idx/],
  ["F16 category index", /expenses_category_date_idx/],
  ["F17 project index", /expenses_project_date_idx/],
  ["F18 creator status index", /expenses_status_creator_idx/],
  ["F19 expenses FORCE RLS", /expenses force row level security/],
  ["F20 categories FORCE RLS", /expense_categories force row level security/],
  ["F21 owner admin read only", /current_profile_role\(\) in \('owner', 'admin'\)/],
  ["F22 server mutation auth", /finance operation requires owner or admin/],
  ["F23 fixed search path", /security definer[\s\S]*set search_path = pg_catalog/],
  ["F24 public and anon revoked", /revoke all on function public\.finance_write/],
  ["F25 category create event", /expense_category_created/],
  ["F26 category update event", /expense_category_updated/],
  ["F27 expense recorded event", /expense_recorded/],
  ["F28 expense reversed event", /expense_reversed/],
  ["F29 report export event", /financial_report_exported/],
  ["F30 human actor", /v_actor\.id,v_actor\.email/],
  ["F31 sold separated", /sold_minor bigint/],
  ["F32 collected separated", /collected_minor bigint/],
  ["F33 outstanding separated", /outstanding_minor bigint/],
  ["F34 overdue separated", /overdue_minor bigint/],
  ["F35 recurring collected separated", /recurring_collected_minor bigint/],
  ["F36 expenses separated", /expense_minor bigint/],
  ["F37 net cash exact", /t\.collected-t\.spent/],
  ["F38 summary is one USD perspective", /select 'USD'::text/],
  ["F39 ordinary finance UI is labeled USD", /Moneda: USD/],
  ["F40 monthly chart rejects non-USD", /p_currency <> 'USD'/],
  ["F41 chart textual alternative", /alternativa tabular/],
  ["F42 server report function", /public\.finance_report/],
  ["F43 server pagination", /limit p_page_size offset/],
  ["F44 pagination bounded", /p_page_size not between 1 and 200/],
  ["F45 collections report", /'collections'/],
  ["F46 receivables report", /'receivables'/],
  ["F47 overdue report", /'overdue'/],
  ["F48 expenses report", /'expenses'/],
  ["F49 cash result report", /'cash_result'/],
  ["F50 project sales report", /'project_sales'/],
  ["F51 seller report", /'seller'/],
  ["F52 reports reject non-USD", /p_currency is not null and p_currency <> 'USD'/],
  ["F53 client filter", /p_client_id is null or r\.client_id=p_client_id/],
  ["F54 project filter", /p_project_id is null or r\.project_id=p_project_id/],
  ["F55 seller filter", /p_seller_id is null or r\.seller_id=p_seller_id/],
  ["F56 method filter", /p_payment_method is null or r\.payment_method=p_payment_method/],
  ["F57 category filter", /p_category_id is null or r\.category_id=p_category_id/],
  ["F58 finance permissions", /"finance:view"/],
  ["F59 expense create permission", /"expenses:create"/],
  ["F60 expense reverse permission", /"expenses:reverse"/],
  ["F61 export permission", /"reports:export"/],
  ["F62 admin receives finance permissions", /admin: \[[\s\S]*"finance:view"/],
  ["F63 manager denied global finance", /manager: \[[^\]]*?"reports:view"/],
  ["F64 sales denied global finance", /sales_agent: \[[\s\S]*?"billing:view"[\s\S]*?\],[\s\S]*?};/],
  ["F65 API validates minor units", /regex\(\/\^\[1-9\]\[0-9\]/],
  ["F66 API accepts only USD", /z\.literal\("USD"\)/],
  ["F67 API authorizes server-side", /hasPermission\(admin,permissions/],
  ["F68 CSV export", /text\/csv/],
  ["F69 spreadsheet formula defense", /\^\[=\+\\-@\]/],
  ["F70 export row safety cap", /page<=25/],
  ["F71 export is private no-store", /private, no-store/],
  ["F72 no PDF risky dependency", /Exportar CSV/],
  ["F73 mobile expense cards", /kc-mobile-cards/],
  ["F74 mobile report cards", /kc-mobile-cards/],
  ["F75 no delete expense UI", /Anular gasto/],
  ["F76 reversal needs reason", /reason\.trim\(\)\.length<3/],
  ["F77 cash terminology accurate", /no es utilidad contable/],
  ["F78 sold terminology accurate", /no es efectivo cobrado/],
  ["F79 empty states have no fake data", /No hay datos ficticios/],
  ["F80 no email code", /expense_recorded/],
];

for (const [name, pattern] of cases) test(name, () => assert.match(all, pattern));
test("F39b ordinary finance UI exposes no HNL", () => assert.doesNotMatch(dashboard + expense + reports, /HNL|Todas las monedas|USD y HNL/));
test("F81 finance implementation never sends email or push", () => assert.doesNotMatch(sql + usdSql + data + api, /resend\.com|sendEmail|sendPush|firebase-admin/i));
test("F82 migration does not seed business expenses", () => assert.doesNotMatch(sql.slice(0, sql.indexOf("create or replace function public.finance_write")), /insert into public\.expenses/));
test("F83 money columns are never floating point", () => assert.doesNotMatch(sql + usdSql, /amount_minor\s+(real|double precision|numeric)/i));
