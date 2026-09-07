import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { draftFingerprint, isMeaningfulDraft } from "../src/lib/mail/draft-autosave.ts";
import { sanitizeMailHtml } from "../src/lib/mail/security.ts";
import { canonicalUsername, USERNAME_LOGIN_ERROR, validateUsername } from "../src/lib/auth/username.ts";
import { buildCrmInvitationEmail } from "../src/lib/admin/invitation.ts";

const read = (path) => readFileSync(path, "utf8");
const migration = [
  "supabase/migrations/20260907000100_username_login_hardening.sql",
  "supabase/migrations/20260907000200_mail_signature_template_versioning.sql",
  "supabase/migrations/20260907000300_notification_scheduler_outbox.sql",
].map(read).join("\n");
const mail = read("src/lib/mail/service.ts");
const workspace = read("src/components/admin/mail-workspace.tsx");
const login = read("src/app/api/auth/login/route.ts");

function emptyDraft(overrides = {}) {
  return {
    identityId: null, signatureId: null, threadId: null, to: [], cc: [], bcc: [], subject: "", html: "",
    context: { leadId: null, clientId: null, projectId: null, addOnId: null, proposalId: null },
    ...overrides,
  };
}

test("task reminders use authenticated Supabase Cron every five minutes", () => {
  assert.equal(JSON.parse(read("vercel.json")).crons, undefined);
  assert.match(migration, /cron\.schedule\('ken-code-task-reminders','\*\/5 \* \* \* \*'/);
  assert.match(migration, /vault\.create_secret\(p_secret,'task_reminder_cron_secret'/);
  const route = read("src/app/api/cron/task-reminders/route.ts");
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /export async function POST/);
});

test("Owner can activate the production scheduler without exposing its secret", () => {
  const route = read("src/app/api/admin/settings/task-reminders/route.ts");
  const settings = read("src/components/admin/admin-settings-panel.tsx");
  assert.match(route, /access\.admin\.role !== "owner"/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /task_reminder_configure_scheduler/);
  assert.match(route, /https:\/\/kencodehn\.com\/api\/cron\/task-reminders/);
  assert.doesNotMatch(route, /console\.(?:log|error)\([^\n]*secret/i);
  assert.doesNotMatch(route, /NextResponse\.json\([^\n]*secret/i);
  assert.match(settings, /Activar recordatorios programados/);
  assert.match(settings, /isOwner/);
});

test("assignment dispatchers target one active assignee and both external channels", () => {
  for (const path of ["src/lib/notifications/task-assignment.ts", "src/lib/notifications/lead-assignment.ts"]) {
    const source = read(path);
    assert.match(source, /\.eq\("id", .*assigned_to\)/);
    assert.match(source, /sendPushToUser/);
    assert.match(source, /sendOperationalNotificationEmail/);
    assert.match(source, /idempotencyKey/);
  }
  const repository = read("src/lib/data/repositories/supabase.ts");
  const outbox = read("src/lib/notifications/assignment-outbox.ts");
  assert.match(repository, /processAssignmentNotificationEvents/);
  assert.match(outbox, /dispatchTaskAssignment\(event\.entity_id\)/);
  assert.match(outbox, /dispatchLeadAssignment\(event\.entity_id\)/);
  assert.match(migration, /assignment_notification_events/);
  assert.match(migration, /next_attempt_at/);
});

test("foreground operational push produces a visible in-app alert", () => {
  const chrome = read("src/components/admin/admin-chrome.tsx");
  assert.match(chrome, /showAppToast/);
  assert.match(chrome, /payload\.data\?\.type === "system"/);
  assert.match(chrome, /kc:push-received/);
});

test("device lifecycle records activity, expiration and stale cleanup", () => {
  const push = read("src/lib/push/service.ts");
  assert.match(migration, /last_seen_at timestamptz/);
  assert.match(migration, /expires_at timestamptz/);
  assert.match(push, /180 \* 24 \* 60 \* 60_000/);
  assert.match(push, /last_seen_at: now/);
  assert.match(push, /\.lt\("last_seen_at"/);
});

test("draft fingerprints stay stable across server version changes", () => {
  const payload = emptyDraft({ subject: "Seguimiento" });
  assert.equal(draftFingerprint(payload), draftFingerprint(structuredClone(payload)));
  assert.equal(isMeaningfulDraft(payload), true);
  assert.equal(isMeaningfulDraft(emptyDraft()), false);
  assert.doesNotMatch(workspace.slice(workspace.indexOf("useEffect(() => {\n    if (!compose) return;"), workspace.indexOf("async function discardDraft")), /draft\.version|attachments\.length/);
  assert.match(workspace, /lastSavedFingerprint\.current = draftFingerprint/);
  assert.match(workspace, /closeAfterAutosave/);
});

test("thread details include authorized attachment metadata and mobile download links", () => {
  assert.match(mail, /mail_attachments.*message_id/s);
  assert.match(mail, /attachments\.get\(message\.id\)/);
  assert.match(workspace, /attachment\.content_type/);
  assert.match(workspace, /api\/admin\/mail\/attachments\?id=/);
});

test("Mail dates render in the same Honduras timezone on server and browser", () => {
  assert.match(workspace, /formatHondurasDate\(item\.updated_at\)/);
  assert.match(workspace, /formatHondurasDateTime\(/);
  assert.doesNotMatch(workspace, /toLocale(?:Date)?String\("es-HN"/);
});

test("signature sanitizer preserves the marker and only safe external images", () => {
  const safe = sanitizeMailHtml('<div data-kc-signature="corporate:abc"><img src="https://cdn.example/logo.png" width="420"></div>', { signatureContent: true });
  assert.match(safe, /data-kc-signature/);
  assert.match(safe, /https:\/\/cdn\.example\/logo\.png/);
  const unsafe = sanitizeMailHtml('<img src="javascript:alert(1)"><script>alert(1)</script>', { signatureContent: true });
  assert.doesNotMatch(unsafe, /javascript:|script/i);
});

test("corporate signatures and templates publish immutable versions atomically", () => {
  assert.match(migration, /corporate_mail_signatures/);
  assert.match(migration, /publish_corporate_mail_signature/);
  assert.match(migration, /publish_mail_template/);
  assert.match(migration, /signature_snapshot jsonb/);
  assert.ok(mail.indexOf('from("corporate_mail_signatures")') < mail.lastIndexOf('from("mail_signatures")'));
  assert.match(mail, /insertSignatureBeforeQuote/);
  assert.match(mail, /data-kc-quoted-history/);
});

test("signature images are processed and restricted to the owned public bucket", () => {
  const assets = read("src/app/api/admin/mail/signature-assets/route.ts");
  const settings = read("src/app/api/admin/mail/settings/route.ts");
  assert.match(assets, /sharp\(/);
  assert.match(assets, /512_000|500 \* 1024/);
  assert.match(assets, /\.webp\(/);
  assert.match(settings, /candidate\.origin === storage\.origin/);
  assert.match(settings, /mail-signature-assets/);
});

test("username policy canonicalizes case and blocks reserved or ambiguous values", () => {
  assert.equal(canonicalUsername("  NicoleGuerra  "), "nicoleguerra");
  assert.equal(validateUsername("NICOLEGuerra").canonical, "nicoleguerra");
  assert.equal(validateUsername("admin").ok, false);
  assert.equal(validateUsername("ni..cole").ok, false);
  assert.match(migration, /profiles_username_canonical_uq/);
  assert.match(migration, /username_history/);
  assert.match(migration, /180 days/);
});

test("dual login resolves usernames only on the server and keeps failures generic", () => {
  assert.match(login, /username_canonical/);
  assert.match(login, /auth_login_attempts/);
  assert.match(login, /minimumDelay/);
  assert.match(login, /USERNAME_LOGIN_ERROR/);
  assert.doesNotMatch(login, /return json\(\{[^}]*email/s);
  assert.equal(USERNAME_LOGIN_ERROR, "Correo/usuario o contraseña incorrectos, o la cuenta no está disponible.");
});

test("invitation tells the verified recipient their username without exposing a password", () => {
  const invitation = buildCrmInvitationEmail("Nicole", "https://example.test/access", "nicoleguerra");
  assert.match(invitation.text, /nicoleguerra/);
  assert.match(invitation.html, /nicoleguerra/);
  assert.doesNotMatch(invitation.text, /contraseña:\s*\S+/i);
});

test("team, query and navigation hardening remain visible in source", () => {
  assert.match(read("src/components/admin/team-panel.tsx"), /!member\.lastLoginAt/);
  assert.match(read("src/lib/admin/supabase-users.ts"), /const counts = new Map/);
  assert.doesNotMatch(read("src/lib/data/repositories/supabase.ts"), /new Error\(error\.message/);
  for (const path of ["mail", "equipo", "seguridad", "clientes/[id]", "proyectos/[id]"]) {
    assert.match(read(`src/app/admin/${path}/loading.tsx`), /AdminRouteLoading/);
  }
});
