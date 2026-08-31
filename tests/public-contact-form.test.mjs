import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLeadRecord } from "../src/lib/leads.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const form = read("../src/components/site/quote-form.tsx");
const pages = read("../src/components/site/localized-pages.tsx");
const shell = read("../src/components/site/public-shell.tsx");
const route = read("../src/app/api/leads/route.ts");
const delivery = read("../src/lib/email/lead-notification.ts");
const email = read("../src/lib/email/service.ts");
const migration = read("../supabase/migrations/20260902001200_public_contact_lead_routing.sql");
const leadDetail = read("../src/components/admin/lead-detail.tsx");

const input = {
  name: "Cliente de prueba",
  business: "Negocio de prueba",
  email: "cliente@example.com",
  phone: "+504 9999-9999",
  project: "Web para negocios",
  message: "Necesito información sobre un sitio web.",
  locale: "es",
  sourcePath: "/contacto",
};

test("public contact becomes a new CRM lead from the website", () => {
  const lead = createLeadRecord(input, { userAgent: "test", referer: "test", ip: "test" });
  assert.equal(lead.status, "new");
  assert.equal(lead.source, "public_website");
  assert.equal(lead.sourcePath, "/contacto");
  assert.equal(lead.crm.assignedTo, null);
});

test("contact and quote grids allow tracks to shrink below intrinsic content", () => {
  assert.match(pages, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(pages, /lg:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/);
  assert.match(pages, /className="min-w-0 flex-1"/);
  assert.match(pages, /break-words text-sm/);
});

test("every public lead form control is width constrained", () => {
  assert.match(form, /kc-card min-w-0 max-w-full/);
  assert.ok((form.match(/w-full min-w-0 max-w-full/g) ?? []).length >= 6);
  assert.match(form, /min-h-36 w-full min-w-0 max-w-full/);
});

test("contact forms remove floating widgets that can cover mobile submit", () => {
  assert.match(shell, /const isLeadForm = \["\/contacto", "\/en\/contact", "\/cotizar", "\/en\/quote"\]/);
  assert.match(shell, /isLeadForm \? null : <KenAiChat/);
  assert.match(shell, /isLeadForm \? null : <FloatingContact/);
});

test("form prevents duplicate clicks and reuses an idempotency key after retry", () => {
  assert.match(form, /if \(submittingRef\.current\) return/);
  assert.match(form, /submissionIdRef\.current \|\|= newSubmissionId\(\)/);
  assert.match(form, /submissionId: submissionIdRef\.current/);
  assert.match(form, /submissionIdRef\.current = newSubmissionId\(\)/);
});

test("public API validates authoritative contact fields and source pages", () => {
  assert.match(route, /email: z\.string\(\)\.trim\(\)\.email\(\)\.max\(180\)/);
  assert.match(route, /sourcePath: z\.enum\(\["\/contacto", "\/en\/contact", "\/cotizar", "\/en\/quote"\]\)/);
  assert.match(route, /submissionId: z\.string\(\)\.uuid\(\)/);
  assert.match(route, /website: z\.string\(\)\.max\(0\)/);
});

test("persistent retry protection is enforced by a unique database key", () => {
  assert.match(migration, /public_submission_key uuid/);
  assert.match(migration, /unique index[\s\S]*leads_public_submission_key_unique/);
  assert.match(migration, /on conflict \(public_submission_key\)[\s\S]*do nothing/);
  assert.match(migration, /where public_submission_key = v_submission_key/);
});

test("internal notification uses an exact lead deep link", () => {
  assert.match(migration, /'Nueva solicitud desde el sitio web'/);
  assert.match(migration, /'\/admin\/leads\/' \|\| v_id::text/);
  assert.match(migration, /recipient_id/);
});

test("only authorized global lead roles receive an unassigned web lead event", () => {
  assert.match(migration, /p\.role in \('owner', 'admin', 'manager', 'viewer'\)/);
  assert.doesNotMatch(migration, /p\.role in \([^)]*sales_agent/);
  assert.match(migration, /p\.active = true/);
});

test("notification RLS keeps each recipient isolated", () => {
  assert.ok((migration.match(/recipient_id = auth\.uid\(\)/g) ?? []).length >= 3);
  assert.match(migration, /private\.current_profile_active\(\)/);
});

test("internal, push and email channels honor personal preferences", () => {
  assert.match(migration, /pref\.internal_enabled/);
  assert.match(migration, /proposal_activity,crm/);
  assert.match(delivery, /sendOperationalNotificationEmail/);
  assert.match(delivery, /sendPushToUser/);
  assert.match(delivery, /event: "proposal_activity"/);
});

test("confirmation email is idempotent and independent from lead persistence", () => {
  assert.match(email, /public-lead:\$\{leadId\}:confirmation/);
  const persistence = route.indexOf('rpc("create_public_lead"');
  const confirmation = route.indexOf("const clientEmail = await safeSecondary");
  assert.ok(persistence > -1 && confirmation > persistence);
  assert.match(route, /safeSecondary\([\s\S]*"clientEmail"/);
});

test("secondary settings and delivery failures cannot roll back a stored lead", () => {
  const persistence = route.indexOf('rpc("create_public_lead"');
  const settings = route.indexOf('"settings"');
  const staff = route.indexOf('"staffChannels"');
  const client = route.indexOf('"clientEmail"');
  assert.ok(persistence > -1 && settings > persistence && staff > settings && client > staff);
  assert.ok((route.match(/safeSecondary\(/g) ?? []).length >= 5);
});

test("public response does not expose provider delivery details", () => {
  const responseBlock = route.slice(route.indexOf("return NextResponse.json({", route.indexOf("confirmationQueued")));
  assert.doesNotMatch(responseBlock.slice(0, 500), /provider|push|emailSent|reason/);
});

test("lead detail presents business origin and source page labels", () => {
  assert.match(leadDetail, /leadSourceLabel\(lead\.source\)/);
  assert.match(leadDetail, /leadSourcePageLabel\(lead\.sourcePath\)/);
  assert.match(leadDetail, /Mensaje original/);
});

test("field validation remains associated and preserves entered values", () => {
  assert.ok((form.match(/aria-describedby=/g) ?? []).length >= 5);
  assert.match(form, /setErrors\(result\.fieldErrors\)/);
  assert.doesNotMatch(form.slice(form.indexOf("response.status === 400"), form.indexOf("setSubmitState(\"success\")")), /setForm\(/);
});

test("success and error feedback are clear, dismissible and non-technical", () => {
  assert.match(form, /Hemos recibido tu solicitud\. Nuestro equipo revisará la información/);
  assert.match(form, /aria-label=\{locale === "es" \? "Cerrar mensaje"/);
  assert.match(form, /window\.setTimeout[\s\S]*5200/);
  assert.doesNotMatch(form, /Supabase|database|provider|stack trace/);
});
