import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ui = read("src/components/admin/ui.tsx");
const actions = read("src/components/admin/receivable-actions.tsx");
const project = read("src/components/admin/project-detail.tsx");
const moduleDetail = read("src/components/admin/module-detail.tsx");
const authorization = read("src/lib/admin/authorization.ts");
const route = read("src/app/api/admin/billing/route.ts");
const migration = read("supabase/migrations/20260902001700_interaction_future_billing_hardening.sql");

test("shared confirmation dialog does not remount its focus trap while typing", () => {
  assert.match(ui, /const onCancelRef = useRef\(onCancel\)/);
  assert.match(ui, /const loadingRef = useRef\(loading\)/);
  assert.match(ui, /\}, \[open\]\);/);
  assert.doesNotMatch(ui, /\}, \[loading, onCancel, open\]\);/);
});

test("dialog escape uses current callbacks without restarting focus management", () => {
  assert.match(ui, /!loadingRef\.current\) onCancelRef\.current\(\)/);
  assert.match(ui, /focusTarget\?\.isConnected/);
  assert.match(ui, /open && !wasOpenRef\.current/);
  assert.doesNotMatch(ui, /setTimeout\([^)]*focus/);
});

test("dialog returns focus to a persistent menu trigger when its menu item unmounts", () => {
  assert.match(ui, /directTrigger\?\.closest<HTMLElement>\('\[role="menu"\]'\)/);
  assert.match(ui, /parentMenu\?\.previousElementSibling/);
  assert.match(ui, /pointerTriggerRef\.current = stableTrigger \?\? directTrigger/);
  assert.match(ui, /returnFocusRef\.current\?\.isConnected \? returnFocusRef\.current : pointerTriggerRef\.current/);
});

test("shared dialog includes inputs, textareas and selects in its keyboard trap", () => {
  assert.match(ui, /input:not\(\[disabled\]\)/);
  assert.match(ui, /select:not\(\[disabled\]\)/);
  assert.match(ui, /textarea:not\(\[disabled\]\)/);
});

test("receivable corrections require a reason and prevent double submission", () => {
  assert.match(actions, /reason\.trim\(\)\.length < 3/);
  assert.match(actions, /if \(busy/);
  assert.match(actions, /loading=\{busy\}/);
});

test("receivable UI distinguishes recurring period cancellation", () => {
  assert.match(actions, /Cancelar este período/);
  assert.match(actions, /no volverá a generarse/);
  assert.match(actions, /Cancelar cobro/);
});

test("paid and partially paid receivables never expose cancellation", () => {
  assert.match(actions, /paymentState === "open" && !hasPayment/);
  assert.match(actions, /ya tiene un pago aplicado/);
  assert.match(actions, /está pagado y su historial financiero está protegido/);
});

test("recurring service deactivation previews preservation versus cancellation", () => {
  assert.match(project, /Conservarlos/);
  assert.match(project, /Cancelar los que no tienen pagos/);
  assert.match(project, /cualquier período pagado o parcialmente pagado se conservará/);
});

test("add-on recurring service uses the same safe deactivation operation", () => {
  assert.match(moduleDetail, /operation: "recurring_service_deactivate"/);
  assert.match(moduleDetail, /serviceType: "add_on"/);
  assert.match(moduleDetail, /cobros futuros sin pagos/);
});

test("role matrix grants future correction to Owner, Admin and Manager only", () => {
  assert.match(authorization, /"billing:correct_future"/);
  const manager = authorization.match(/manager: \[([^\]]+)\]/s)?.[1] ?? "";
  const sales = authorization.match(/sales_agent: \[([^\]]+)\]/s)?.[1] ?? "";
  const viewer = authorization.match(/viewer: \[([^\]]+)\]/s)?.[1] ?? "";
  assert.match(manager, /billing:correct_future/);
  assert.doesNotMatch(sales, /billing:correct_future/);
  assert.doesNotMatch(viewer, /billing:correct_future/);
});

test("billing API separates future corrections from payment reversals", () => {
  assert.match(route, /recurring_service_deactivate/);
  assert.match(route, /"billing:correct_future"/);
  assert.match(route, /parsed\.data\.operation==="payment_reverse"[\s\S]*"financial:reverse"/);
});

test("recurring exceptions are RLS protected and auditable", () => {
  assert.match(migration, /create table public\.recurring_period_exceptions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /created_by uuid not null/);
  assert.match(migration, /reason text not null/);
});

test("empty correction is a cancellation and never a destructive delete", () => {
  const cancelFn = migration.match(/create or replace function private\.cancel_empty_receivable[\s\S]*?\n\$\$;/)?.[0] ?? "";
  assert.match(cancelFn, /payment_state = 'cancelled'/);
  assert.match(cancelFn, /notifications_enabled = false/);
  assert.match(cancelFn, /schedule_version = schedule_version \+ 1/);
  assert.doesNotMatch(cancelFn, /delete from public\.receivables/);
});

test("any active payment allocation blocks cancellation", () => {
  assert.match(migration, /amount_paid_minor <> 0 or exists/);
  assert.match(migration, /payment_allocations[\s\S]*reversed_at is null/);
  assert.match(migration, /financial activity cannot be cancelled/);
});

test("cancelled base recurring periods cannot regenerate", () => {
  assert.match(migration, /recurring_period_exceptions e[\s\S]*e\.project_recurring_service_id=v_service\.id and e\.period_key=v_period/);
});

test("cancelled add-on recurring periods cannot regenerate", () => {
  assert.match(migration, /recurring_period_exceptions e[\s\S]*e\.add_on_recurring_service_id=v_service\.id and e\.period_key=v_period/);
});

test("a period exception is scoped to one period and preserves the next period", () => {
  assert.match(migration, /unique index recurring_period_exceptions_base_idx[\s\S]*project_recurring_service_id, period_key/);
  assert.match(migration, /unique index recurring_period_exceptions_add_on_idx[\s\S]*add_on_recurring_service_id, period_key/);
  assert.doesNotMatch(migration, /update public\.project_recurring_services set status = 'cancelled'[\s\S]*p_operation = 'receivable_cancel'/);
});

test("service deactivation can cancel only future empty periods", () => {
  assert.match(migration, /r\.due_date > v_today/);
  assert.match(migration, /v_row\.amount_paid_minor = 0 and not v_row\.has_allocation/);
  assert.match(migration, /v_protected := v_protected \+ 1/);
});

test("service deactivation records actor, reason and impact", () => {
  assert.match(migration, /recurring_service_deactivated/);
  assert.match(migration, /'cancelledFuture', v_cancelled/);
  assert.match(migration, /'preservedFuture', v_protected/);
  assert.match(migration, /'reason', v_reason/);
});

test("deactivation preview is authoritative and permission checked", () => {
  assert.match(migration, /create or replace function public\.billing_correction_preview/);
  assert.match(migration, /count\(\*\) filter/);
  assert.match(route, /export async function GET/);
  assert.match(route, /billing:correct_future/);
  assert.match(project, /openRecurringDeactivation[\s\S]*\/api\/admin\/billing\?serviceType=base/);
  assert.match(moduleDetail, /openRecurringDeactivation[\s\S]*serviceType=add_on/);
});

test("correction RPC denies roles outside Owner Admin and Manager", () => {
  assert.match(migration, /v_actor\.role not in \('owner', 'admin', 'manager'\)/);
  assert.match(migration, /billing correction forbidden/);
});

test("financial history remains protected by forced RLS and explicit RPC grants", () => {
  assert.match(migration, /revoke all on function public\.billing_correction_write\(text,jsonb\) from public,anon/);
  assert.match(migration, /grant execute on function public\.billing_correction_write\(text,jsonb\) to authenticated/);
});
