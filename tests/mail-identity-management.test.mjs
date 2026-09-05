import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultPermissionsForRole } from "../src/lib/admin/authorization.ts";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ui = read("src/components/admin/mail-identity-manager.tsx");
const composer = read("src/components/admin/mail-workspace.tsx");
const service = read("src/lib/mail/service.ts");
const sql = read("supabase/migrations/20260905000100_mail_identity_management.sql");
test("only Owner has corporate identity administration", () => {
  for (const role of ["owner", "admin", "manager", "sales_agent", "viewer"]) assert.equal(defaultPermissionsForRole(role).includes("mail:manage_identities"), role === "owner");
});
test("identity actions are explicit and important changes explain impact", () => {
  for (const label of ["Reactivar identidad", "Editar identidad", "Asignar responsable", "Cambiar responsable", "Establecer como principal", "Quitar como principal", "Desasignar de usuario", "Desactivar identidad"]) assert.ok(ui.includes(label), label);
  assert.doesNotMatch(ui, />\s*[×✕]\s*<|<X\b/);
  assert.match(ui, /Esta persona dejará de poder enviar desde esta dirección/);
  assert.match(ui, /Esta es la identidad principal de/);
  assert.match(ui, /Reemplazará su principal anterior, sin desasignar/);
});
test("composer uses assigned active identities and prefers the primary", () => {
  assert.match(service, /eq\("mail_identity_assignments.profile_id", admin.uid\)/);
  assert.match(service, /eq\("mail_identity_assignments.active", true\).eq\("status", "active"\)/);
  assert.match(composer, /initial.identities.find\([\s\S]*assignment.is_primary/);
  assert.match(composer, /No tiene una dirección de Ken Code activa asignada/);
  assert.match(composer, /Configurar direcciones/);
  assert.match(composer, /disabled=\{busy \|\| sending \|\| !identityId\}/);
});
test("new From uses current display name while sent messages retain snapshots", () => {
  assert.ok(service.includes('from: `${identity.display_name} <${identity.email}>`'));
  assert.ok(service.includes('from_address: { email: identity.email, name: identity.display_name }'));
  assert.doesNotMatch(sql, /(?:update|delete from)\s+(?:public\.)?mail_(?:messages|threads|attachments)\b/i);
  assert.match(sql, /set display_name = btrim\(p_display_name\)/);
});
test("management RPC enforces authorization, atomicity and auditing", () => {
  assert.match(sql, /current_profile_role\(\) <> 'owner'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /Active identity required/);
  assert.match(sql, /Active assignment required/);
  assert.match(sql, /insert into mail_audit_events/);
});
