export const ADMIN_ROLES = ["owner", "admin", "manager", "viewer"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "leads:view",
  "leads:edit",
  "notes:view",
  "notes:edit",
  "tasks:view",
  "tasks:edit",
  "tasks:delete",
  "activity:view",
  "notifications:view",
  "notifications:edit",
  "reports:view",
  "settings:view",
  "settings:manage",
  "push:manage",
  "users:manage",
  "maintenance:run",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminUser = {
  uid: string;
  email: string;
  role: AdminRole;
  active: true;
  permissions: AdminPermission[];
};

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  admin: [
    "leads:view",
    "leads:edit",
    "notes:view",
    "notes:edit",
    "tasks:view",
    "tasks:edit",
    "tasks:delete",
    "activity:view",
    "notifications:view",
    "notifications:edit",
    "reports:view",
    "settings:view",
    "settings:manage",
    "push:manage",
  ],
  manager: ["leads:view", "leads:edit", "reports:view"],
  viewer: ["leads:view"],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export function defaultPermissionsForRole(role: AdminRole): AdminPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(admin: AdminUser, permission: AdminPermission) {
  return admin.active && admin.permissions.includes(permission);
}

export function hasEveryPermission(admin: AdminUser, permissions: readonly AdminPermission[]) {
  return permissions.every((permission) => hasPermission(admin, permission));
}

export function parseEmailList(value: string | undefined | null) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailInList(email: string | undefined | null, configuredEmails: string | undefined | null) {
  if (!email) return false;
  return parseEmailList(configuredEmails).includes(email.trim().toLowerCase());
}

export function resolveAdminUserFromProfile(input: {
  uid: string;
  email: string;
  profile: Record<string, unknown> | null | undefined;
}): AdminUser | null {
  if (!input.profile) return null;
  if (!isAdminRole(input.profile.role)) return null;
  if (input.profile.active !== undefined && input.profile.active !== true) return null;
  const profileEmail = typeof input.profile.email === "string" ? input.profile.email.trim().toLowerCase() : "";

  return {
    uid: input.uid,
    email: profileEmail || input.email.trim().toLowerCase(),
    role: input.profile.role,
    active: true,
    permissions: defaultPermissionsForRole(input.profile.role),
  };
}
