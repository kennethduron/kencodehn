import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessLead,
  canAssignLead,
  canResendInvitation,
  defaultPermissionsForRole,
  hasPermission,
  invitationDeliveryUpdate,
  isAssignableSalesAgent,
  isBootstrapOwnerEmail,
  leadDataScopeForAdmin,
  MANAGEABLE_ADMIN_ROLES,
  parseLeadAssignmentInput,
  resolveLeadAssignmentAction,
  resolveInvitationProvisioning,
  resolveAdminUserFromProfile,
} from "../src/lib/admin/authorization.ts";
import { buildCrmInvitationEmail, CRM_INVITATION_SUBJECT } from "../src/lib/admin/invitation.ts";

function adminFor(role, uid = `${role}-uid`, profile = {}) {
  return resolveAdminUserFromProfile({
    uid,
    email: `${role}@example.com`,
    profile: { role, active: true, ...profile },
  });
}

const owner = adminFor("owner");
const admin = adminFor("admin");
const manager = adminFor("manager");
const viewer = adminFor("viewer");
const agentA = adminFor("sales_agent", "agent-a");
const agentB = adminFor("sales_agent", "agent-b");

test("owner puede ver leads asignados a cualquier usuario", () => {
  assert.ok(owner);
  assert.equal(leadDataScopeForAdmin(owner), "global");
  assert.equal(canAccessLead(owner, { assignedToUid: "agent-b" }), true);
});

test("admin puede ver leads asignados a cualquier usuario", () => {
  assert.ok(admin);
  assert.equal(leadDataScopeForAdmin(admin), "global");
  assert.equal(canAccessLead(admin, { assignedToUid: "agent-b" }), true);
});

test("manager conserva scope global y puede distribuir trabajo comercial", () => {
  assert.ok(manager);
  assert.equal(leadDataScopeForAdmin(manager), "global");
  assert.equal(canAccessLead(manager, { assignedToUid: "agent-b" }), true);
  assert.equal(canAssignLead(manager), true);
});

test("viewer conserva lectura global y no puede editar ni asignar", () => {
  assert.ok(viewer);
  assert.equal(canAccessLead(viewer, { assignedToUid: "agent-b" }), true);
  assert.equal(hasPermission(viewer, "leads:edit"), false);
  assert.equal(canAssignLead(viewer), false);
});

test("sales agent A puede ver un lead asignado a A", () => {
  assert.ok(agentA);
  assert.equal(leadDataScopeForAdmin(agentA), "assigned");
  assert.equal(canAccessLead(agentA, { assignedToUid: "agent-a" }), true);
});

test("sales agent A no puede ver un lead asignado a B", () => {
  assert.ok(agentA);
  assert.equal(canAccessLead(agentA, { assignedToUid: "agent-b" }), false);
});

test("sales agent A no puede ver un lead sin asignar", () => {
  assert.ok(agentA);
  assert.equal(canAccessLead(agentA, { assignedToUid: null }), false);
});

test("lead historico sin assignedToUid se interpreta como sin asignar", () => {
  assert.ok(owner);
  assert.ok(agentA);
  assert.equal(canAccessLead(owner, {}), true);
  assert.equal(canAccessLead(agentA, {}), false);
});

test("sales agent puede editar su lead por permiso y ownership", () => {
  assert.ok(agentA);
  assert.equal(hasPermission(agentA, "leads:edit"), true);
  assert.equal(canAccessLead(agentA, { assignedToUid: "agent-a" }), true);
});

test("sales agent no puede editar un lead ajeno", () => {
  assert.ok(agentA);
  assert.equal(hasPermission(agentA, "leads:edit"), true);
  assert.equal(canAccessLead(agentA, { assignedToUid: "agent-b" }), false);
});

test("sales agent no puede reasignar leads", () => {
  assert.ok(agentA);
  assert.equal(hasPermission(agentA, "leads:assign"), false);
  assert.equal(canAssignLead(agentA), false);
});

test("owner puede asignar leads", () => {
  assert.ok(owner);
  assert.equal(hasPermission(owner, "leads:assign"), true);
  assert.equal(canAssignLead(owner), true);
});

test("admin puede asignar leads segun la matriz explicita", () => {
  assert.ok(admin);
  assert.equal(hasPermission(admin, "leads:assign"), true);
  assert.equal(canAssignLead(admin), true);
});

test("admin puede consultar vendedores asignables sin users:manage", () => {
  assert.ok(admin);
  assert.equal(canAssignLead(admin), true);
  assert.equal(hasPermission(admin, "users:manage"), false);
});

test("sales agent no puede consultar vendedores asignables", () => {
  assert.ok(agentA);
  assert.equal(canAssignLead(agentA), false);
});

test("target de asignacion debe ser sales_agent explicitamente activo", () => {
  assert.equal(isAssignableSalesAgent({ role: "sales_agent", active: true }), true);
  assert.equal(isAssignableSalesAgent({ role: "sales_agent", active: false }), false);
  assert.equal(isAssignableSalesAgent({ role: "sales_agent" }), false);
  assert.equal(isAssignableSalesAgent({ role: "manager", active: true }), false);
});

test("same-assignee es idempotente y unassign es una operacion explicita", () => {
  assert.equal(resolveLeadAssignmentAction("agent-a", "agent-a"), "unchanged");
  assert.equal(resolveLeadAssignmentAction("agent-a", null), "unassigned");
  assert.equal(resolveLeadAssignmentAction(null, "agent-a"), "assigned");
  assert.equal(resolveLeadAssignmentAction("agent-a", "agent-b"), "reassigned");
});

test("request de assignment no puede forjar nombre, email o role", () => {
  assert.deepEqual(parseLeadAssignmentInput({ assignedToUid: " agent-a " }), { ok: true, assignedToUid: "agent-a" });
  assert.deepEqual(parseLeadAssignmentInput({ assignedToUid: null }), { ok: true, assignedToUid: null });
  assert.deepEqual(parseLeadAssignmentInput({ assignedToUid: "agent-a", assignedToName: "Owner" }), { ok: false });
  assert.deepEqual(parseLeadAssignmentInput({ assignedToUid: "agent-a", email: "forged@example.com" }), { ok: false });
  assert.deepEqual(parseLeadAssignmentInput({ assignedToUid: "agent-a", role: "owner" }), { ok: false });
});

test("sales agent no puede ejecutar unassign", () => {
  assert.ok(agentA);
  assert.equal(parseLeadAssignmentInput({ assignedToUid: null }).ok, true);
  assert.equal(canAssignLead(agentA), false);
});

test("sales agent recibe modulos personales de tareas y notificaciones en 0C", () => {
  assert.ok(agentA);
  assert.equal(hasPermission(agentA, "tasks:view"), true);
  assert.equal(hasPermission(agentA, "tasks:edit"), true);
  assert.equal(hasPermission(agentA, "tasks:delete"), false);
  assert.equal(hasPermission(agentA, "notifications:view"), true);
  assert.equal(hasPermission(agentA, "notifications:edit"), true);
});

test("perfil invitado deriva permisos exclusivamente de su rol almacenado", () => {
  const invited = adminFor("sales_agent", "invited", { permissions: ["users:manage", "maintenance:run"] });
  assert.ok(invited);
  assert.deepEqual(invited.permissions, defaultPermissionsForRole("sales_agent"));
  assert.equal(hasPermission(invited, "users:manage"), false);
});

test("ADMIN_EMAILS por si solo no satisface el bootstrap Owner", () => {
  assert.equal(isBootstrapOwnerEmail("allowed@example.com", "allowed@example.com", "owner@example.com"), false);
  assert.equal(isBootstrapOwnerEmail("allowed@example.com", "allowed@example.com", ""), false);
});

test("bootstrap Owner exige simultaneamente ambas listas explicitas", () => {
  assert.equal(isBootstrapOwnerEmail("owner@example.com", "owner@example.com", "owner@example.com"), true);
  assert.equal(isBootstrapOwnerEmail("OWNER@example.com", " owner@example.com ", " OWNER@example.com "), true);
});

test("inactive y cambio de rol se reflejan desde el perfil actual", () => {
  const identity = { uid: "member", email: "member@example.com" };
  const initial = resolveAdminUserFromProfile({ ...identity, profile: { role: "admin", active: true } });
  const changed = resolveAdminUserFromProfile({ ...identity, profile: { role: "sales_agent", active: true } });
  const inactive = resolveAdminUserFromProfile({ ...identity, profile: { role: "sales_agent", active: false } });
  assert.ok(initial);
  assert.ok(changed);
  assert.equal(canAssignLead(initial), true);
  assert.equal(canAssignLead(changed), false);
  assert.equal(inactive, null);
});

test("desactivar un vendedor no requiere alterar el ownership persistido", () => {
  const lead = Object.freeze({ assignedToUid: "agent-a" });
  const inactiveAgent = resolveAdminUserFromProfile({
    uid: "agent-a",
    email: "agent@example.com",
    profile: { role: "sales_agent", active: false },
  });
  assert.equal(inactiveAgent, null);
  assert.equal(lead.assignedToUid, "agent-a");
  assert.ok(agentB);
  assert.equal(canAccessLead(agentB, lead), false);
});

test("owner no es un rol invitable por el flujo ordinario", () => {
  assert.equal(MANAGEABLE_ADMIN_ROLES.includes("owner"), false);
  assert.deepEqual([...MANAGEABLE_ADMIN_ROLES], ["admin", "manager", "viewer", "sales_agent"]);
});

test("invitacion duplicada no cambia rol y solo estados pendientes permiten reenvio", () => {
  const stored = Object.freeze({ role: "viewer", active: true, invitationStatus: "failed" });
  assert.equal(resolveInvitationProvisioning(true, true), "reject_existing_profile");
  assert.equal(resolveInvitationProvisioning(true, false), "reject_existing_profile");
  assert.equal(resolveInvitationProvisioning(false, true), "reuse_firebase_user");
  assert.equal(resolveInvitationProvisioning(false, false), "create_firebase_user");
  assert.equal(canResendInvitation(stored), true);
  assert.equal(stored.role, "viewer");
  assert.equal(canResendInvitation({ ...stored, invitationStatus: "accepted" }), false);
  assert.equal(canResendInvitation({ ...stored, active: false }), false);
  assert.equal(canResendInvitation({ role: "owner", active: true, invitationStatus: "failed" }), false);
});

test("fallo de email queda reintentable y un reintento exitoso pasa a sent", () => {
  const failed = invitationDeliveryUpdate(false, "resend_send_failed", "2026-08-27T10:00:00.000Z");
  assert.equal(failed.invitationStatus, "failed");
  assert.equal(failed.invitationError, "resend_send_failed");
  assert.equal(canResendInvitation({ role: "sales_agent", active: true, invitationStatus: failed.invitationStatus }), true);
  const retried = invitationDeliveryUpdate(true, null, "2026-08-27T10:05:00.000Z");
  assert.equal(retried.invitationStatus, "sent");
  assert.equal(retried.invitationError, null);
});

test("template de invitacion usa Ken Code, no contiene password y escapa el nombre", () => {
  const template = buildCrmInvitationEmail("<Agent>", "https://example.test/action?token=mock");
  assert.equal(template.subject, CRM_INVITATION_SUBJECT);
  assert.match(template.text, /Ken Code/);
  assert.match(template.html, /Ken Code/);
  assert.match(template.html, /&lt;Agent&gt;/);
  assert.doesNotMatch(template.text.toLowerCase(), /password temporal/);
  assert.doesNotMatch(template.html.toLowerCase(), /api key|secret/);
});
