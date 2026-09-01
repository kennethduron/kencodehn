import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260902001300_owner_historical_workflow.sql",
  "utf8",
);
const wizard = readFileSync(
  "src/components/admin/historical-import-wizard.tsx",
  "utf8",
);
const billing = readFileSync("src/components/admin/billing-panel.tsx", "utf8");
const client = readFileSync("src/components/admin/client-detail.tsx", "utf8");
const project = readFileSync("src/components/admin/project-detail.tsx", "utf8");
const moduleDetail = readFileSync(
  "src/components/admin/module-detail.tsx",
  "utf8",
);
const payments = readFileSync("src/app/admin/pagos/page.tsx", "utf8");
const finance = readFileSync(
  "src/components/admin/finance-dashboard.tsx",
  "utf8",
);
const route = readFileSync(
  "src/app/api/admin/historical-import/route.ts",
  "utf8",
);
const data = readFileSync("src/lib/billing/data.ts", "utf8");

const cases = [
  [
    "01 historical sessions are auditable",
    migration,
    /create table public\.historical_import_sessions/,
  ],
  [
    "02 one active session per client",
    migration,
    /historical_import_one_active_client/,
  ],
  [
    "03 session RLS enabled",
    migration,
    /historical_import_sessions enable row level security/,
  ],
  [
    "04 session RLS forced",
    migration,
    /historical_import_sessions force row level security/,
  ],
  [
    "05 only Owner Admin can start",
    migration,
    /v_actor\.role not in \('owner', 'admin'\)/,
  ],
  [
    "06 client reminders pause",
    migration,
    /billing_notifications_enabled = false/,
  ],
  [
    "07 completion requires explicit reminder decision",
    migration,
    /p_enable_reminders boolean default false/,
  ],
  [
    "08 elapsed reminder windows skipped",
    migration,
    /scheduled_at <= now\(\)[\s\S]*historical_import/,
  ],
  ["09 project historical CTA", client, /Registrar información histórica/],
  [
    "10 wizard has eight business steps",
    wizard,
    /Proyecto original[\s\S]*Pagos del proyecto[\s\S]*Mensualidades anteriores[\s\S]*Revisión final/,
  ],
  [
    "11 historical project uses current project engine",
    wizard,
    /project_create/,
  ],
  [
    "12 historical plan uses current plan engine",
    wizard,
    /payment_plan_save[\s\S]*payment_plan_activate/,
  ],
  [
    "13 project distribution checked",
    wizard,
    /total distribuido debe coincidir exactamente/,
  ],
  ["14 project effective date", wizard, /Fecha efectiva/],
  ["15 project payment CTA", project, /Registrar pago/],
  ["16 project direct Cobros link", project, /\/admin\/cobros\?projectId=/],
  ["17 client direct payment CTA", client, /\/admin\/cobros\?clientId=.*pay=1/],
  [
    "18 historical payment disables confirmation",
    billing,
    /notifyClient:\s*historicalMode[\s\S]*\? false/,
  ],
  [
    "19 one payment can cover multiple Cobros",
    billing,
    /allocations:\s*Object\.entries\(selected\)/,
  ],
  ["20 recurring preview rendered", wizard, /Vista previa de periodos/],
  [
    "21 recurring historical confirmation",
    wizard,
    /Confirmo estos periodos históricos/,
  ],
  [
    "22 historical recurring uses current engine",
    wizard,
    /recurring_service_save/,
  ],
  ["23 historical module composite", migration, /historical_add_on_create/],
  [
    "24 historical module preserves proposal",
    migration,
    /insert into public\.add_on_proposals/,
  ],
  [
    "25 historical module preserves sale",
    migration,
    /insert into public\.add_on_sales/,
  ],
  [
    "26 historical module preserves plan",
    migration,
    /insert into public\.add_on_payment_plans/,
  ],
  [
    "27 historical module creates Cobros",
    migration,
    /insert into public\.receivables/,
  ],
  [
    "28 effective acceptance stored",
    migration,
    /v_effective_date.*add_on_sales/s,
  ],
  [
    "29 module direct payment CTA",
    moduleDetail,
    /\/admin\/cobros\?addOnId=.*pay=1/,
  ],
  [
    "30 module three states",
    moduleDetail,
    /Comercial[\s\S]*Desarrollo[\s\S]*Financiero/,
  ],
  [
    "31 module paid and partial labels",
    moduleDetail,
    /Pagado[\s\S]*Pago parcial/,
  ],
  [
    "32 module contextual billing is exact",
    data,
    /contains\("metadata",\s*\{\s*addOnId:\s*input\.addOnId\s*\}\)/,
  ],
  [
    "33 monthly base and add-on summary",
    client,
    /Servicio base[\s\S]*Módulos adicionales[\s\S]*Total mensual/,
  ],
  [
    "34 payments guidance",
    payments,
    /Los pagos se registran a partir de un Cobro pendiente/,
  ],
  [
    "35 proposal wording separates registration",
    moduleDetail,
    /Registrar como enviada no envía un correo/,
  ],
  [
    "36 effective acceptance input",
    moduleDetail,
    /Fecha efectiva de aceptación/,
  ],
  [
    "37 recurring wording reflects Cobros",
    project,
    /genera Cobros desde la fecha de inicio/,
  ],
  [
    "38 Finance warns about outside period",
    finance,
    /Existen movimientos fuera de este periodo/,
  ],
  [
    "39 historical route has strict roles",
    route,
    /\['owner', 'admin'\]|\["owner", "admin"\]/,
  ],
  ["40 responsive vertical mobile wizard", wizard, /grid gap-4 sm:grid-cols-2/],
];
for (const [name, source, pattern] of cases)
  test(name, () => assert.match(source, pattern));
test("41 historical migration sends no email", () =>
  assert.doesNotMatch(migration, /resend|send_email|net\.http_post/i));
test("42 historical migration sends no push", () =>
  assert.doesNotMatch(migration, /send_push|fcm/i));
test("43 historical migration schedules no cron", () =>
  assert.doesNotMatch(migration, /cron\.schedule/i));
test("44 historical UI contains no implementation jargon", () => {
  for (const term of ["RPC", "UUID", "Supabase", "database", "cron"])
    assert.doesNotMatch(wizard, new RegExp(`\\b${term}\\b`, "i"));
});
test("45 client business dates hydrate consistently", () => {
  assert.match(client, /timeZone: "America\/Tegucigalpa"/);
  assert.doesNotMatch(client, /toLocaleString\("es-HN"\)/);
});
