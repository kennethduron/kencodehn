import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeModuleName, similarHistoricalModules } from "../src/lib/historical-import/module-matching.ts";

const data = readFileSync("src/lib/add-ons/data.ts", "utf8");
const detail = readFileSync("src/components/admin/module-detail.tsx", "utf8");
const wizard = readFileSync("src/components/admin/historical-import-wizard.tsx", "utf8");
const route = readFileSync("src/app/api/admin/historical-import/route.ts", "utf8");
const lifecycleRoute = readFileSync("src/app/api/admin/lifecycle/route.ts", "utf8");
const lifecycleUi = readFileSync("src/components/admin/lifecycle-actions.tsx", "utf8");
const authorization = readFileSync("src/lib/admin/authorization.ts", "utf8");
const moduleMigration = readFileSync("supabase/migrations/20260902001400_module_financial_consistency.sql", "utf8");
const lifecycleMigration = readFileSync("supabase/migrations/20260902001500_safe_record_lifecycle.sql", "utf8");
const eligibilityMigration = readFileSync("supabase/migrations/20260902001600_safe_delete_eligibility_refinement.sql", "utf8");
const leadRoute = readFileSync("src/app/api/admin/leads/[id]/route.ts", "utf8");
const taskRoute = readFileSync("src/app/api/admin/tasks/[id]/route.ts", "utf8");
const tasksUi = readFileSync("src/components/admin/tasks-panel.tsx", "utf8");
const billingRoute = readFileSync("src/app/api/admin/billing/route.ts", "utf8");
const paymentPage = readFileSync("src/app/admin/pagos/[id]/page.tsx", "utf8");
const identityUi = readFileSync("src/components/admin/mail-identity-manager.tsx", "utf8");
const auditScript = readFileSync("scripts/module-financial-readonly-audit.mjs", "utf8");

test("numeric Supabase bigint values remain present", () => assert.match(data, /v===null\|\|v===undefined\|\|v===""\?null:String\(v\)/));
test("module commercial amount comes from authoritative sale", () => assert.match(detail, /soldMinor = sale\?\.acceptedAmountMinor/));
test("approved sale renders one coherent commercial label", () => assert.match(detail, /Venta registrada:/));
test("financial denominator uses authoritative sold amount", () => assert.match(detail, /formatMinor\(soldMinor \|\| "0"/));
test("financial module summary separates sold collected and pending", () => {
  for (const label of ["Precio vendido", "Cobrado", "Pendiente"]) assert.match(detail, new RegExp(label));
  assert.doesNotMatch(detail, /<strong>\{formatMinor\(addOn\.paidMinor[\s\S]*\} de/);
});
test("approved without authoritative sale becomes review-required", () => assert.match(detail, /addOn\.commercialStatus === "approved" \? "Revisión requerida"/));
test("effective commercial date is visible", () => assert.match(detail, /Fecha efectiva:/));
test("payment actions require a sale", () => assert.match(detail, /\{sale \? \([\s\S]*Ver cobros[\s\S]*Registrar pago/));
test("unsold module offers historical sale workflow", () => assert.match(detail, /Registrar venta histórica/));
test("draft proposal has explicit safe discard", () => {
  assert.match(detail, /entity: "proposal"/);
  assert.match(detail, /Descartar borrador/);
});
test("archived modules are excluded from ordinary lists", () => assert.match(data, /\.is\("archived_at",null\)/));
test("module name normalization handles accents and generic words", () => assert.equal(normalizeModuleName("Módulo Contable"), "contable"));
test("similar module detection is project scoped", () => {
  const modules = [
    { id: "a", projectId: "p1", name: "Módulo Contable" },
    { id: "b", projectId: "p2", name: "Modulo Contable" },
  ];
  assert.deepEqual(similarHistoricalModules(modules, "p1", "Modulo contable").map((item) => item.id), ["a"]);
});
test("historical wizard warns instead of silently duplicating", () => assert.match(wizard, /Ya existe un módulo con un nombre similar/));
test("historical wizard offers existing, deliberate new and cancel", () => {
  assert.match(wizard, /Usar existente:/);
  assert.match(wizard, /Crear de todas formas/);
  assert.match(wizard, />Cancelar</);
});
test("existing module id is strictly validated", () => assert.match(route, /existingAddOnId: z\.string\(\)\.uuid\(\)\.optional/));
test("existing module completion is atomic server-side", () => assert.match(moduleMigration, /historical_add_on_complete_existing/));
test("existing module must belong to selected client and project", () => assert.match(moduleMigration, /outside the selected client\/project/));
test("existing sold module cannot be completed again", () => assert.match(moduleMigration, /exists\(select 1 from public\.add_on_sales/));
test("non-draft proposal history blocks automatic conversion", () => assert.match(moduleMigration, /status <> 'draft'/));
test("old draft is preserved as superseded", () => assert.match(moduleMigration, /set status = 'superseded'/));
test("historical completion creates accepted proposal", () => assert.match(moduleMigration, /insert into public\.add_on_proposals/));
test("historical completion creates authoritative sale", () => assert.match(moduleMigration, /insert into public\.add_on_sales/));
test("historical completion creates plan and Cobros", () => assert.match(moduleMigration, /insert into public\.add_on_payment_plans[\s\S]*insert into public\.receivables/));
test("historical completion requires active paused session", () => assert.match(moduleMigration, /status = 'active'[\s\S]*for update/));
test("historical completion emits no mail, push or schedule", () => assert.doesNotMatch(moduleMigration, /resend|send_email|send_push|fcm|cron\.schedule/i));
test("lifecycle capabilities are explicit", () => {
  for (const capability of ["records:delete_empty", "records:archive", "financial:reverse"]) assert.match(authorization, new RegExp(capability));
});
test("Manager receives operational lifecycle capabilities", () => assert.match(authorization, /manager:[\s\S]*records:delete_empty[\s\S]*records:archive/));
test("Sales Agent and Viewer remain conservative", () => {
  const viewer = authorization.match(/viewer:\s*\[[^\]]*\]/)?.[0] || "";
  const sales = authorization.match(/sales_agent:\s*\[[\s\S]*?\n\s*\],/)?.[0] || "";
  assert.doesNotMatch(viewer + sales, /records:delete_empty|financial:reverse/);
});
test("lifecycle inspection runs behind active profile authorization", () => assert.match(lifecycleMigration, /where id=auth\.uid\(\) and active/));
test("Payments Cobros and expenses are never hard-deleted", () => assert.match(lifecycleMigration, /p_entity in \('payment','receivable','expense'\)[\s\S]*v_delete:=false/));
test("lifecycle action must match the server recommendation", () => assert.match(lifecycleMigration, /p_action is distinct from v_info->>'recommendedAction'/));
test("financial history recommends auditable action", () => assert.match(lifecycleMigration, /when 'payment' then 'reverse'.*when 'receivable' then 'cancel'/));
test("empty Leads have dependency checks", () => assert.match(lifecycleMigration, /lead_notes[\s\S]*tasks[\s\S]*clients[\s\S]*mail_threads/));
test("client financial relationships block hard delete", () => assert.match(lifecycleMigration, /receivables where client_id=p_id[\s\S]*payments where client_id=p_id/));
test("project plans recurrence modules and Cobros block hard delete", () => assert.match(lifecycleMigration, /project_payment_plans[\s\S]*project_recurring_services[\s\S]*project_add_ons[\s\S]*receivables/));
test("module proposal sale Cobro Payment context blocks hard delete", () => assert.match(lifecycleMigration, /add_on_proposals[\s\S]*add_on_sales[\s\S]*metadata->>'addOnId'/));
test("accepted proposals are preserved", () => assert.match(lifecycleMigration, /status<>'draft'/));
test("recurring services with generated Cobros are preserved", () => assert.match(lifecycleMigration, /receivables where recurring_service_id=p_id/));
test("used Mail identities are preserved", () => assert.match(lifecycleMigration, /mail_threads where identity_id=p_id[\s\S]*mail_messages where sender_identity_id=p_id/));
test("unused Mail identity cleanup is explicit and preserves audit", () => assert.match(lifecycleMigration, /update public\.mail_audit_events set identity_id=null[\s\S]*delete from public\.mail_signatures[\s\S]*delete from public\.mail_identity_assignments/));
test("Mail identity UI gates deletion by eligibility and makes deactivation reversible", () => {
  assert.match(identityUi, /identity\.lifecycle\.deleteAllowed/);
  assert.match(identityUi, /identity\.status !== "active"[\s\S]*Reactivar identidad[\s\S]*Desactivar identidad/);
});
test("legacy browser-wide cleanup execution is revoked", () => assert.match(lifecycleMigration, /revoke execute on function public\.delete_lead_cascade[\s\S]*cleanup_operational_data\(\) from authenticated/));
test("new lifecycle migration introduces no destructive cascade", () => assert.doesNotMatch(lifecycleMigration, /on delete cascade/i));
test("lifecycle application preserves a business audit entry", () => assert.match(lifecycleMigration, /insert into public\.activity_logs/));
test("global More actions pattern has reason and confirmation", () => {
  assert.match(lifecycleUi, /Más acciones/);
  assert.match(lifecycleUi, /ConfirmDialog/);
  assert.match(lifecycleUi, /Motivo/);
});
test("destructive dialog is viewport bounded and touch friendly", () => assert.match(lifecycleUi, /w-\[min\(20rem,calc\(100vw-2rem\)\)\][\s\S]*min-h-11/));
test("lifecycle API checks explicit capability", () => assert.match(lifecycleRoute, /records:delete_empty[\s\S]*records:archive/));
test("lifecycle inspection API also requires archive capability", () => assert.match(lifecycleRoute, /export async function GET[\s\S]*records:archive/));
test("payment reversal remains sensitive while empty future corrections use their operational capability", () => {
  assert.match(billingRoute, /receivable_cancel"\|\|parsed\.data\.operation==="recurring_service_deactivate"[\s\S]*billing:correct_future/);
  assert.match(billingRoute, /operation==="payment_reverse"[\s\S]*financial:reverse/);
});
test("payment page does not infer reversal from payment-entry capability", () => assert.match(paymentPage, /canReverse=\{hasPermission\(admin,"financial:reverse"\)\}/));
test("Lead deletion no longer calls broad cascade", () => {
  assert.match(leadRoute, /applyRecordLifecycle\("lead"/);
  assert.doesNotMatch(leadRoute, /deleteLeadCascade/);
});
test("task deletion uses safe lifecycle inspection", () => assert.match(taskRoute, /applyRecordLifecycle\("task"/));
test("task UI checks lifecycle before showing destructive confirmation", () => {
  assert.match(tasksUi, /openLifecycle[\s\S]*recommendedAction === "delete"/);
  assert.match(tasksUi, /Más acciones/);
});
test("read-only financial audit contains no mutation methods", () => assert.doesNotMatch(auditScript, /\.(insert|update|upsert|delete)\s*\(/));
test("module creation audit does not block safe deletion", () => assert.doesNotMatch(eligibilityMigration.match(/action in \([\s\S]*?\)/)?.[0] || "", /module_created/));
test("delivered work status is auxiliary without business history", () => assert.doesNotMatch(eligibilityMigration.match(/action in \([\s\S]*?\)/)?.[0] || "", /module_delivered/));
test("module assignment events are explicitly cleaned, not treated as business history", () => {
  assert.match(eligibilityMigration, /delete from public\.add_on_seller_assignment_events where add_on_id=p_id/);
  assert.doesNotMatch(eligibilityMigration.match(/private\.module_lifecycle_blockers[\s\S]*?return v_blockers/)?.[0] || "", /add_on_seller_assignment_events/);
});
test("accepted sale remains an authoritative module blocker", () => assert.match(eligibilityMigration, /add_on_sales where add_on_id=p_id[\s\S]*approved_sale/));
test("accepted amount inconsistency fails closed", () => assert.match(eligibilityMigration, /commercial_status='approved'[\s\S]*accepted_proposal_id is not null[\s\S]*accepted_amount_minor/));
test("module Cobros are resolved through relational and legacy metadata paths", () => assert.match(eligibilityMigration, /add_on_installments[\s\S]*add_on_payment_plans[\s\S]*add_on_recurring_services[\s\S]*metadata->>'addOnId'/));
test("module payment allocations block hard delete", () => assert.match(eligibilityMigration, /payment_allocations[\s\S]*pa\.reversed_at is null[\s\S]*'payment'/));
test("real module Mail remains a blocker", () => assert.match(eligibilityMigration, /mail_threads where add_on_id=p_id[\s\S]*commercial_mail/));
test("non-draft proposals remain protected", () => assert.match(eligibilityMigration, /add_on_proposals where add_on_id=p_id and status<>'draft'/));
test("module blocker reason identifies payment precisely", () => assert.match(eligibilityMigration, /No puede eliminarse porque tiene un pago registrado/));
test("module blocker reason identifies approved sale precisely", () => assert.match(eligibilityMigration, /No puede eliminarse porque existe una venta aprobada/));
test("module blocker reason identifies Cobro precisely", () => assert.match(eligibilityMigration, /No puede eliminarse porque tiene un cobro registrado/));
test("module blocker reason identifies commercial correspondence precisely", () => assert.match(eligibilityMigration, /No puede eliminarse porque contiene correspondencia comercial/));
test("empty module reason describes commercial and financial eligibility", () => assert.match(eligibilityMigration, /no tiene ventas, cobros ni pagos registrados/));
test("module safe delete removes only auxiliary notifications and detaches audit links", () => assert.match(eligibilityMigration, /delete from public\.notifications where add_on_id=p_id[\s\S]*update public\.activity_logs set add_on_id=null/));
test("lead creation and ordinary edits are auxiliary", () => assert.match(eligibilityMigration, /lead_created[\s\S]*lead_updated[\s\S]*lead_assigned/));
test("client creation edits and assignment are auxiliary", () => assert.match(eligibilityMigration, /client_created[\s\S]*client_updated[\s\S]*client_assigned/));
test("project creation edits and assignment are auxiliary", () => assert.match(eligibilityMigration, /project_created[\s\S]*project_updated[\s\S]*project_assigned/));
test("accidental pending task edits are auxiliary but completed tasks remain history", () => assert.match(eligibilityMigration, /status in \('completed','cancelled','overdue'\)[\s\S]*task_created[\s\S]*task_updated/));
test("unused recurring services remain deletable only before generating Cobros", () => assert.match(eligibilityMigration, /recurring_service'[\s\S]*receivables where recurring_service_id=p_id/));
test("refinement introduces no destructive cascade", () => assert.doesNotMatch(eligibilityMigration, /on delete cascade/i));
test("module dialog explains permanent deletion consequences", () => assert.match(lifecycleUi, /Este módulo no tiene ventas, cobros ni pagos registrados[\s\S]*Eliminar definitivamente/));
test("module action has a clear business label", () => assert.match(lifecycleUi, /module: "Eliminar módulo"/));
