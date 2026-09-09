import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync("src/components/admin/mail-workspace.tsx", "utf8");
const service = readFileSync("src/lib/mail/service.ts", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

test("Mail list metadata remains bounded in the existing server-side query", () => {
  assert.match(service, /mail_read_states\(profile_id,unread\)/);
  assert.match(service, /mail_attachments\(id\)/);
  assert.match(service, /\.eq\("mail_read_states\.profile_id", admin\.uid\)/);
  assert.doesNotMatch(workspace, /fetch\([^\n]+mail_read_states/);
});

test("conversation rows expose real unread, attachment, importance and follow-up states", () => {
  assert.match(workspace, /state\.profile_id === admin\.uid/);
  assert.match(workspace, /message\.mail_attachments\?\.length/);
  assert.match(workspace, /thread\.follow_up_at/);
  assert.match(workspace, /thread\.is_important/);
});

test("empty reader and empty search use professional Spanish states", () => {
  assert.match(workspace, /Seleccione una conversación/);
  assert.match(workspace, /Lea, responda y vincule cada correo con el contexto comercial/);
  assert.match(workspace, /No se encontraron conversaciones/);
  assert.match(workspace, /Pruebe con otro nombre, correo o asunto/);
});

test("thread actions and quick reply execute existing handlers", () => {
  assert.match(workspace, /onClick=\{\(\) => openReply\("reply"\)\}/);
  assert.match(workspace, /onClick=\{\(\) => openReply\("replyAll"\)\}/);
  assert.match(workspace, /onClick=\{\(\) => openReply\("forward"\)\}/);
  assert.match(workspace, /Escriba una respuesta\.\.\./);
});

test("CRM context links only to existing related records", () => {
  assert.match(workspace, /`\/admin\/clientes\/\$\{selected\.thread\.client_id\}`/);
  assert.match(workspace, /`\/admin\/leads\/\$\{selected\.thread\.lead_id\}`/);
  assert.match(workspace, /`\/admin\/proyectos\/\$\{selected\.thread\.project_id\}`/);
  assert.match(workspace, /`\/admin\/modulos\/\$\{selected\.thread\.add_on_id\}`/);
  assert.doesNotMatch(workspace, /href=\{item\.href \|\| "#"\}/);
});

test("composer keeps real identities, copies, templates, signatures and attachments", () => {
  assert.match(workspace, /initial\.identities\.map/);
  assert.match(workspace, /CC · BCC/);
  assert.match(workspace, /applyTemplate/);
  assert.match(workspace, /applySignature/);
  assert.match(workspace, /uploadAttachment/);
  assert.match(workspace, /Firma que se incluirá/);
});

test("composer keeps autosave and idempotent send protections", () => {
  assert.match(workspace, /setTimeout\(\(\) => void persistAutosave\(entry\), 1500\)/);
  assert.match(workspace, /sendRequestId\.current/);
  assert.match(workspace, /disabled=\{busy \|\| sending \|\| !identityId\}/);
  assert.doesNotMatch(workspace, />Programar</);
});

test("Mail contains sender HTML and oversized embedded content", () => {
  assert.match(css, /\.kc-mail-message-html img[\s\S]*max-width: 100% !important/);
  assert.match(css, /\.kc-mail-message-html table[\s\S]*overflow-x: auto/);
  assert.match(css, /\.kc-mail-message-html pre[\s\S]*white-space: pre-wrap/);
});

test("desktop, tablet, phone and short landscape layouts remain explicit", () => {
  assert.match(css, /@media \(max-width: 1279px\)[\s\S]*kc-mail-shell/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*kc-mail-folders/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*kc-mail-mobile-actions/);
  assert.match(css, /@media \(max-width: 374px\)/);
  assert.match(css, /@media \(max-height: 650px\) and \(orientation: landscape\)/);
});

test("mobile drawer, composer and controls preserve safe interaction targets", () => {
  assert.match(workspace, /kc-mail-folder-scrim/);
  assert.match(workspace, /h-\[100dvh\]/);
  assert.match(workspace, /env\(safe-area-inset-top\)/);
  assert.match(css, /\.kc-mail-mobile-actions button[\s\S]*min-height: 3rem/);
});
