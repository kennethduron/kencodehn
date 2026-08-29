import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addMinor, compareMinor, formatMinor, minorToDecimalInput, parseMoneyToMinor, parseMinor } from "../src/lib/billing/money.ts";

const sql = readFileSync("supabase/migrations/20260830000100_phase2_receivables_payments.sql", "utf8");
const automationSql = readFileSync("supabase/migrations/20260830000200_phase2_automated_billing.sql", "utf8");
const api = readFileSync("src/app/api/admin/billing/route.ts", "utf8");
const commercialApi = readFileSync("src/app/api/admin/commercial/route.ts", "utf8");
const moneySource = readFileSync("src/lib/billing/money.ts", "utf8");
const commercialData = readFileSync("src/lib/commercial/data.ts", "utf8");
const projectDetail = readFileSync("src/components/admin/project-detail.tsx", "utf8");
const projectList = readFileSync("src/components/admin/project-list.tsx", "utf8");

const cases = [
  ["01 receivables are first-class obligations", /create table public\.receivables/],
  ["02 installment origin is explicit", /origin_type public\.receivable_origin_type/],
  ["03 installment origin FK is restrictive", /project_installment_id uuid references public\.project_installments\(id\) on delete restrict/],
  ["04 recurring origin FK is restrictive", /recurring_service_id uuid references public\.project_recurring_services\(id\) on delete restrict/],
  ["05 origin combinations are constrained", /constraint receivable_origin_valid/],
  ["06 installment origin is unique", /unique index receivables_installment_origin_idx/],
  ["07 recurring period is unique", /unique index receivables_recurring_period_idx/],
  ["08 receivable amount is positive BIGINT", /amount_due_minor bigint not null check \(amount_due_minor > 0\)/],
  ["09 paid amount is nonnegative BIGINT", /amount_paid_minor bigint not null default 0/],
  ["10 balance is DB generated", /balance_minor bigint generated always as/],
  ["11 paid cannot exceed due", /receivable_paid_not_over_due/],
  ["12 payment and timing states are not mixed", /receivable_payment_state as enum \('open', 'partially_paid', 'paid', 'cancelled'\)/],
  ["13 currency is ISO shaped", /currency text not null check \(currency ~ '\^\[A-Z\]\{3\}\$'\)/],
  ["14 civil due date is retained", /due_date date not null/],
  ["15 due time remains optional", /due_time time without time zone/],
  ["16 Honduras timezone is explicit", /due_timezone text not null default 'America\/Tegucigalpa'/],
  ["17 timestamp derives with make_timestamptz", /make_timestamptz/],
  ["18 schedule changes increment a version", /new\.schedule_version := old\.schedule_version \+ 1/],
  ["19 plan activation materializes receivables", /payment_plan_materialize_receivables/],
  ["20 materialization uses conflict dedupe", /on conflict\(project_installment_id\) where project_installment_id is not null do nothing/],
  ["21 incomplete materialization aborts", /plan receivable materialization incomplete/],
  ["22 active installments require due dates", /every active installment requires a due date/],
  ["23 replacing a paid plan is blocked", /active plan with financial activity cannot be replaced/],
  ["24 unpaid replaced-plan obligations are cancelled", /Plan comercial reemplazado/],
  ["25 payments represent posted or reversed money", /financial_payment_status as enum \('posted', 'reversed'\)/],
  ["26 payment methods are maintained in a DB enum", /payment_method as enum \('bank_transfer', 'cash', 'card', 'paypal', 'other'\)/],
  ["27 payments require a recorder", /recorded_by uuid not null references public\.profiles/],
  ["28 reversal metadata is mandatory", /payment_reversal_consistent/],
  ["29 allocations implement many-to-many", /create table public\.payment_allocations/],
  ["30 allocation amounts are positive BIGINT", /amount_minor bigint not null check \(amount_minor > 0\)/],
  ["31 duplicate allocation targets are blocked", /unique\(payment_id, receivable_id\)/],
  ["32 posting locks target receivables", /order by r\.id for update/],
  ["33 cross-client allocation is rejected", /cross-client allocation rejected/],
  ["34 cross-currency allocation is rejected", /cross-currency allocation rejected/],
  ["35 over-allocation is rejected", /allocation exceeds outstanding balance/],
  ["36 allocation sum must equal payment", /allocation sum must equal payment amount/],
  ["37 partial payments update state", /partially_paid/],
  ["38 completed balances update state", /then 'paid'::public\.receivable_payment_state/],
  ["39 reversal preserves allocation history", /update public\.payment_allocations set reversed_at=now\(\),reversed_by=v_actor\.id/],
  ["40 reversal reopens receivables", /set amount_paid_minor=amount_paid_minor-v_allocation\.amount_minor/],
  ["41 financial history hard delete is blocked", /financial history cannot be deleted/],
  ["42 all three financial tables have delete guards", /receivables_no_delete[\s\S]*payments_no_delete[\s\S]*allocations_no_delete/],
  ["43 financial mutation requires an active profile", /where id = auth\.uid\(\) and active/],
  ["44 financial mutation is Owner or Admin only", /role not in \('owner','admin'\)/],
  ["45 receivable RLS is enabled and forced", /receivables enable row level security;[\s\S]*receivables force row level security/],
  ["46 payment RLS is enabled and forced", /payments enable row level security;[\s\S]*payments force row level security/],
  ["47 allocation RLS is enabled and forced", /payment_allocations enable row level security;[\s\S]*payment_allocations force row level security/],
  ["48 writes are exposed only through the RPC", /grant select on public\.receivables, public\.payments, public\.payment_allocations to authenticated/],
  ["49 project balance excludes recurring receivables", /filter \(where r\.origin_type='project_installment'/],
  ["50 project total is sourced from projects", /p\.total_amount_minor/],
  ["51 API minor units are decimal-free strings", /const minor=z\.string\(\)\.regex/],
  ["52 commercial API minor units are strings", /const moneyMinor = z\.string\(\)\.regex/],
  ["53 payment API does not accept client balances", /operation:z\.literal\("payment_post"\)/],
  ["54 payment API revalidates every allocation", /allocations:z\.array/],
  ["55 project data does not coerce BIGINT to Number", /totalAmountMinor: String\(row\.total_amount_minor/],
  ["56 project UI parses decimal input safely", /parseMoneyToMinor/],
  ["57 project UI does not round money with float", /parseMoneyToMinor/],
  ["58 recurring creation stays separate from project total", /billing_generate_recurring/],
];

for (const [name, pattern] of cases) test(name, () => assert.match(sql + automationSql + api + commercialApi + commercialData + projectDetail, pattern));

test("59 decimal parsing is exact", () => assert.equal(parseMoneyToMinor("1499.00"), BigInt(149900)));
test("60 one cent parses exactly", () => assert.equal(parseMoneyToMinor("0.01"), BigInt(1)));
test("61 one decimal is padded", () => assert.equal(parseMoneyToMinor("119.9"), BigInt(11990)));
test("62 three decimals are rejected", () => assert.throws(() => parseMoneyToMinor("1.001")));
test("63 exponent notation is rejected", () => assert.throws(() => parseMoneyToMinor("1e3")));
test("64 negative decimal money is rejected", () => assert.throws(() => parseMoneyToMinor("-1.00")));
test("65 grouping commas are rejected", () => assert.throws(() => parseMoneyToMinor("1,499.00")));
test("66 minor-unit strings reject leading zero ambiguity", () => assert.throws(() => parseMinor("001")));
test("67 minor-unit sum is exact", () => assert.equal(addMinor(["75000", "74900"]), BigInt(149900)));
test("68 minor-unit comparison is exact", () => assert.equal(compareMinor("9007199254740993", "9007199254740992"), 1));
test("69 decimal input conversion is exact", () => assert.equal(minorToDecimalInput("149900"), "1499.00"));
test("70 display preserves cents", () => assert.match(formatMinor("11901", "USD"), /119\.01$/));
test("71 no BigInt is coerced through Number in commercial mapping", () => assert.doesNotMatch(commercialData, /Number\(row\.(total_amount_minor|amount_minor|planned_total_minor|monthly_amount_minor)/));
test("72 project form has no floating money arithmetic", () => assert.doesNotMatch(projectDetail + projectList, /Math\.round|\*\s*100|\/\s*100|\.toFixed\(/));
test("73 money helper has no floating arithmetic", () => assert.doesNotMatch(moneySource, /parseFloat|Number\(|Math\./));
test("74 recurring amount never updates project total", () => {
  const recurring = automationSql.slice(automationSql.indexOf("generate_recurring_receivables_for_service"));
  assert.doesNotMatch(recurring, /update public\.projects[\s\S]*total_amount_minor/);
});
test("75 service-role cannot bypass the payment transaction through table grants", () => assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*public\.(receivables|payments|payment_allocations) to authenticated/i));
test("76 financial RPC has a fixed search path", () => assert.match(sql, /function public\.financial_write[\s\S]*security definer set search_path = pg_catalog/));
