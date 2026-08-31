import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const mail = read("src/components/admin/mail-workspace.tsx");
const editor = read("src/components/admin/rich-text-editor.tsx");
const settings = read("src/components/admin/mail-settings-manager.tsx");
const css = read("src/app/globals.css");
const profileApi = read("src/app/api/admin/profile/route.ts");
const profile = read("src/components/admin/profile-panel.tsx");
const invitations = read("src/lib/admin/supabase-users.ts");
const invitationTemplate = read("src/lib/admin/invitation.ts");
const mailService = read("src/lib/mail/service.ts");
const team = read("src/components/admin/team-panel.tsx");
const billingRules = read("src/components/admin/billing-rules-panel.tsx");
const payment = read("src/components/admin/payment-detail.tsx");

test("reply, reply all and forward use the visual editor", () => {
  assert.match(mail, /openReply\("reply"\)/);
  assert.match(mail, /openReply\("replyAll"\)/);
  assert.match(mail, /openReply\("forward"\)/);
  assert.match(mail, /<RichTextEditor value=\{html\}/);
  assert.doesNotMatch(mail, /<textarea[^>]*value=\{html\}/);
});

test("visual editor renders rich HTML instead of exposing markup", () => {
  assert.match(editor, /contentEditable/);
  assert.match(editor, /editor\.innerHTML = value/);
  assert.match(editor, /insertUnorderedList/);
  assert.match(editor, /insertOrderedList/);
  assert.match(editor, /createLink/);
  assert.match(editor, /formatBlock.*blockquote/s);
  assert.doesNotMatch(editor, /<textarea/);
});

test("signatures and templates also use the visual editor", () => {
  assert.equal((settings.match(/<RichTextEditor/g) || []).length, 2);
  assert.doesNotMatch(settings, /<strong>Nombre<\/strong>|font-mono/);
});

test("global horizontal clipping preserves sticky positioning", () => {
  assert.match(css, /html[\s\S]*overflow-x: clip/);
  assert.match(css, /body[\s\S]*overflow-x: clip/);
  assert.doesNotMatch(css, /overflow-x: hidden/);
});

test("profile replacement and removal roll back when file cleanup fails", () => {
  assert.match(profileApi, /createSupabaseServerClient[\s\S]*rpc\("update_own_profile"/);
  assert.match(profileApi, /displayName: data\.display_name \|\| data\.name \|\| ""/);
  assert.match(profileApi, /No pudimos reemplazar la foto de forma segura/);
  assert.match(profileApi, /profilePhotoPath: current\.profile_photo_path/);
  assert.match(profileApi, /No pudimos quitar la foto de forma segura/);
  assert.match(profileApi, /profilePhotoPath: previousPath/);
  assert.match(profile, /Quitar foto/);
  assert.match(profile, /initials/);
});

test("invitation resend renews access for the existing auth user", () => {
  assert.match(invitations, /getUserById\(uid\)/);
  assert.match(invitations, /generateLink\(\{[\s\S]*type: "recovery"/);
  assert.doesNotMatch(invitations, /generateLink\(\{[\s\S]*type: "invite"/);
  assert.doesNotMatch(invitations, /auth\.resend\(\{ type: "signup"/);
  assert.match(invitations, /last_sign_in_at \|\| target\.lastLoginAt/);
  assert.match(invitations, /INVITATION_RESEND_COOLDOWN_MS = 60_000/);
  assert.match(invitations, /recovery%3Fmode%3Dinvite/);
  assert.match(invitations, /idempotencyKey: `user-invitation-resend/);
  assert.match(invitationTemplate, /solo puede utilizarse una vez/);
});

test("team presents pending invitations as a distinct business state", () => {
  assert.match(team, /Invitación pendiente/);
  assert.match(team, /Esperando aceptación/);
  assert.match(team, /Con acceso activo/);
  assert.match(team, /immutableOwner \? "Owner" : "Nombre no configurado"/);
});

test("mail exposes pending and provider-confirmed delivery states", () => {
  assert.match(mail, /sending \? "Enviando…" : "Enviar"/);
  for (const label of ["Enviado", "Entregado", "No entregado", "Rebotado"]) {
    assert.match(mail, new RegExp(label));
  }
  assert.match(mail, /sendRequestId\.current/);
  assert.match(mailService, /folder === "sent".*neq\("state", "trash"\)/);
  assert.match(mailService, /folder !== "sent" \|\| thread\.mail_messages\?\.some/);
});

test("audited business labels avoid confirmed technical wording", () => {
  assert.doesNotMatch(billingRules, /Automated billing|receivable/);
  assert.doesNotMatch(payment, /Allocations/);
  assert.match(team, /Enviar invitación/);
  assert.doesNotMatch(team, /Firebase generará|Invitacion|Ultimo acceso|Sales Agents|ownership/);
});
