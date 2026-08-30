import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PERMISSIONS,
  defaultPermissionsForRole,
  hasPermission,
  isEmailInList,
  resolveAdminUserFromProfile,
} from "../src/lib/admin/authorization.ts";

function adminFor(role, profile = {}) {
  return resolveAdminUserFromProfile({
    uid: `${role}-uid`,
    email: `${role}@example.com`,
    profile: { role, active: true, ...profile },
  });
}

test("owner conserva acceso a todos los permisos declarados", () => {
  const owner = adminFor("owner");
  assert.ok(owner);
  assert.deepEqual(owner.permissions, [...ADMIN_PERMISSIONS]);
  assert.equal(hasPermission(owner, "users:manage"), true);
  assert.equal(hasPermission(owner, "maintenance:run"), true);
});

test("admin tiene acceso operativo pero no administra usuarios ni mantenimiento", () => {
  const admin = adminFor("admin");
  assert.ok(admin);
  assert.equal(hasPermission(admin, "leads:edit"), true);
  assert.equal(hasPermission(admin, "tasks:delete"), true);
  assert.equal(hasPermission(admin, "settings:manage"), true);
  assert.equal(hasPermission(admin, "users:manage"), false);
  assert.equal(hasPermission(admin, "maintenance:run"), false);
});

test("manager solo recibe el conjunto operativo explicitamente declarado", () => {
  const manager = adminFor("manager");
  assert.ok(manager);
  assert.equal(hasPermission(manager, "leads:view"), true);
  assert.equal(hasPermission(manager, "leads:edit"), true);
  assert.equal(hasPermission(manager, "reports:view"), true);
  assert.equal(hasPermission(manager, "clients:edit"), true);
  assert.equal(hasPermission(manager, "projects:edit"), true);
  assert.equal(hasPermission(manager, "commercial_plans:view"), true);
  assert.equal(hasPermission(manager, "commercial_plans:edit"), false);
  assert.equal(hasPermission(manager, "recurring_services:edit"), false);
  assert.equal(hasPermission(manager, "notes:view"), true);
  assert.equal(hasPermission(manager, "tasks:view"), true);
  assert.equal(hasPermission(manager, "tasks:edit"), true);
  assert.equal(hasPermission(manager, "notifications:view"), true);
  assert.equal(hasPermission(manager, "tasks:delete"), false);
  assert.equal(hasPermission(manager, "settings:view"), false);
  assert.equal(hasPermission(manager, "push:manage"), false);
});

test("viewer puede leer datos comerciales pero no editarlos", () => {
  const viewer = adminFor("viewer");
  assert.ok(viewer);
  assert.equal(hasPermission(viewer, "leads:view"), true);
  assert.equal(hasPermission(viewer, "clients:view"), true);
  assert.equal(hasPermission(viewer, "projects:view"), true);
  assert.equal(hasPermission(viewer, "commercial_plans:view"), true);
  assert.equal(hasPermission(viewer, "clients:edit"), false);
  assert.equal(hasPermission(viewer, "projects:edit"), false);
  assert.equal(hasPermission(viewer, "commercial_plans:edit"), false);
});

test("un perfil explicitamente inactivo es rechazado", () => {
  const inactive = resolveAdminUserFromProfile({
    uid: "inactive-uid",
    email: "inactive@example.com",
    profile: { role: "owner", active: false },
  });
  assert.equal(inactive, null);
});

test("valores active malformados se rechazan y solo la ausencia conserva compatibilidad", () => {
  for (const active of ["false", null, 0, 1]) {
    assert.equal(adminFor("owner", { active }), null);
  }
  assert.ok(adminFor("owner", { active: undefined }));
});

test("perfiles heredados sin active siguen funcionando y roles invalidos se rechazan", () => {
  assert.ok(adminFor("sales_agent"));
  assert.equal(adminFor(undefined), null);
});

test("un perfil administrativo inexistente se rechaza sin fallback", () => {
  const missing = resolveAdminUserFromProfile({
    uid: "missing-uid",
    email: "missing@example.com",
    profile: null,
  });
  assert.equal(missing, null);
});

test("la misma identidad usa el rol y active actuales del perfil", () => {
  const identity = { uid: "stable-uid", email: "stable@example.com" };
  const initialAdmin = resolveAdminUserFromProfile({ ...identity, profile: { role: "admin", active: true } });
  const changedViewer = resolveAdminUserFromProfile({ ...identity, profile: { role: "viewer", active: true } });
  const deactivated = resolveAdminUserFromProfile({ ...identity, profile: { role: "viewer", active: false } });

  assert.ok(initialAdmin);
  assert.ok(changedViewer);
  assert.equal(hasPermission(initialAdmin, "settings:manage"), true);
  assert.equal(hasPermission(changedViewer, "settings:manage"), false);
  assert.equal(hasPermission(changedViewer, "clients:view"), true);
  assert.equal(deactivated, null);
});

test("los permisos efectivos salen de la matriz y no de un arreglo almacenado obsoleto", () => {
  const viewer = adminFor("viewer", { permissions: ["users:manage", "maintenance:run"] });
  assert.ok(viewer);
  assert.deepEqual(viewer.permissions, defaultPermissionsForRole("viewer"));
});

test("el email del contexto sale del perfil y conserva fallback para perfiles heredados", () => {
  const profiled = adminFor("owner", { email: "PROFILE@EXAMPLE.COM" });
  const legacy = adminFor("owner");
  assert.equal(profiled.email, "profile@example.com");
  assert.equal(legacy.email, "owner@example.com");
});

test("la lista de admision normaliza correos y rechaza usuarios no permitidos", () => {
  const configured = " owner@example.com,ADMIN@example.com ";
  assert.equal(isEmailInList("OWNER@example.com", configured), true);
  assert.equal(isEmailInList("admin@example.com", configured), true);
  assert.equal(isEmailInList("unknown@example.com", configured), false);
  assert.equal(isEmailInList(null, configured), false);
});
