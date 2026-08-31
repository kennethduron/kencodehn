import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const service = read("src/lib/mail/service.ts");
const mailRoute = read("src/app/api/admin/mail/route.ts");
const mailUi = read("src/components/admin/mail-workspace.tsx");
const teamUi = read("src/components/admin/team-panel.tsx");
const userRoute = read("src/app/api/admin/users/[uid]/route.ts");
const users = read("src/lib/admin/supabase-users.ts");
const chrome = read("src/components/admin/admin-chrome.tsx");
const ui = read("src/components/admin/ui.tsx");
const migration = read("supabase/migrations/20260902000800_final_micro_closure.sql");
const pushService = read("src/lib/push/service.ts");

test("Sent filters outbound threads in SQL before pagination", () => {
  assert.match(service, /mail_messages!inner/);
  assert.match(service, /eq\("mail_messages\.direction", "outbound"\)/);
  assert.match(service, /not\("last_outbound_at", "is", null\)/);
  assert.doesNotMatch(service, /filter\(\(thread\) => folder !== "sent"/);
});

test("Sent uses a durable last outbound cursor", () => {
  assert.match(migration, /last_outbound_at timestamptz/);
  assert.match(migration, /mail_messages_refresh_outbound_at/);
  assert.match(service, /cursorColumn = folder === "sent" \? "last_outbound_at"/);
});

test("Sent shows recipient, date, and provider delivery state", () => {
  assert.match(mailUi, /Para:.*to_addresses/s);
  assert.match(mailUi, /thread\.last_outbound_at/);
  for (const label of ["Enviado", "Entregado", "Error", "Rebotado"]) assert.match(mailUi, new RegExp(label));
});

test("an inbound reply does not remove a Sent thread", () => {
  assert.match(service, /folder === "sent".*neq\("state", "trash"\)/s);
  assert.match(migration, /if new\.direction = 'outbound'/);
});

test("Trash remains recoverable", () => {
  assert.match(mailRoute, /"restore"/);
  assert.match(mailUi, /act\("restore"/);
  assert.match(mailUi, /Restaurar/);
});

test("permanent mail deletion is explicit and Owner-only", () => {
  assert.match(mailUi, /Eliminar conversación definitivamente/);
  assert.match(mailUi, /no podrá recuperarse/);
  assert.match(service, /admin\.role !== "owner"/);
  assert.match(migration, /role = 'owner'/);
});

test("permanent mail deletion retains linked business history", () => {
  assert.match(migration, /linked business mail must be retained/);
  assert.match(migration, /lead_id is not null.*client_id is not null.*project_id is not null/s);
  assert.match(mailRoute, /vinculada a actividad, seguimiento o adjuntos/);
});

test("permanent mail deletion protects referenced attachments", () => {
  assert.match(migration, /mail attachments are retained by policy/);
  assert.match(migration, /attachmentCount', 0/);
});

test("mail hard-delete RPC is unavailable to browser roles", () => {
  assert.match(migration, /revoke all on function public\.permanently_delete_mail_thread[\s\S]*authenticated/);
  assert.match(migration, /grant execute on function public\.permanently_delete_mail_thread[\s\S]*to service_role/);
});

test("icon-only Mail actions expose hover, focus, and accessible names", () => {
  assert.match(mailUi, /<Tooltip label="Archivar" placement="bottom">/);
  assert.match(mailUi, /<Tooltip label="Mover a Papelera" placement="bottom">/);
  assert.match(mailUi, /<Tooltip label="Eliminar definitivamente" placement="bottom">/);
  assert.match(ui, /createPortal/);
  assert.match(ui, /onMouseEnter.*setOpen\(true\)/s);
  assert.match(ui, /onFocusCapture.*setOpen\(true\)/s);
  assert.match(mailUi, /aria-label="Cerrar carpetas"/);
});

test("top bar and sidebar icon actions remain named", () => {
  assert.match(chrome, /aria-label="Abrir menú de cuenta"/);
  assert.match(chrome, /Tooltip label="Cerrar sesión"/);
  assert.match(chrome, /title="Cerrar sesión"/);
});

test("mobile never depends on hover-only labels", () => {
  assert.match(mailUi, /aria-label="Ver carpetas"/);
  assert.match(mailUi, /aria-label="Volver a conversaciones"/);
  assert.match(mailUi, /Responder a todos/);
  assert.match(mailUi, /Reenviar/);
});

test("unused member deletion requires proof of no login", () => {
  assert.match(migration, /last_login_at is not null/);
  assert.match(migration, /auth\.users where id = p_target and last_sign_in_at is not null/);
  assert.match(migration, /invitation_status = 'accepted'/);
});

test("member deletion checks every real profile foreign key", () => {
  assert.match(migration, /from pg_constraint constraint_row/);
  assert.match(migration, /confrelid = 'public\.profiles'::regclass/);
  assert.match(migration, /migration_id_map/);
});

test("invitation-only evidence is preserved without blocking unused-member deletion", () => {
  assert.match(migration, /email_logs_related_user_id_fkey[\s\S]*on delete set null/);
  assert.match(migration, /activity_logs'[\s\S]*target_user_id/);
  assert.match(migration, /type <> 'user_invitation'/);
});

test("Owner remains protected and member deletion is Owner-only", () => {
  assert.match(migration, /v_target\.role = 'owner' or p_target = p_actor/);
  assert.match(userRoute, /access\.admin\.role !== "owner"/);
  assert.match(teamUi, /immutableOwner/);
});

test("history-bearing members receive a business explanation and deactivation alternative", () => {
  assert.match(migration, /actividad registrada.*Puede desactivar su acceso/);
  assert.match(teamUi, /Desactivar/);
  assert.match(teamUi, /payload\.assessment\.reason/);
});

test("unused-member deletion removes Auth and profile atomically", () => {
  assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  assert.match(users, /auth\.admin\.deleteUser\(uid, false\)/);
  assert.match(userRoute, /export async function DELETE/);
});

test("mobile composer is a full-height dynamic viewport sheet", () => {
  assert.match(mailUi, /h-\[100dvh\] max-h-\[100dvh\]/);
  assert.match(mailUi, /overscroll-contain/);
  assert.match(mailUi, /safe-area-inset-top/);
  assert.match(mailUi, /safe-area-inset-bottom/);
});

test("mobile composer keeps header and actions accessible", () => {
  assert.match(mailUi, /aria-label="Cerrar redacción"/);
  assert.match(mailUi, /<footer className="flex shrink-0/);
  assert.match(mailUi, /document\.body\.style\.overflow = "hidden"/);
  assert.match(mailUi, /event\.key === "Escape"/);
});

test("FCM device queries select the intended profile relationship", () => {
  const explicitRelationships = pushService.match(/profiles!device_tokens_profile_id_fkey\(email,active,role\)/g) || [];
  assert.equal(explicitRelationships.length, 3);
  assert.doesNotMatch(pushService, /select\("\*,profiles\(email\)"\)/);
});
