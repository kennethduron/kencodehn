export const ADMIN_ROLES = ["owner", "admin", "manager", "viewer", "sales_agent"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const MANAGEABLE_ADMIN_ROLES = ["admin", "manager", "viewer", "sales_agent"] as const satisfies readonly AdminRole[];
export type ManageableAdminRole = (typeof MANAGEABLE_ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "leads:view",
  "leads:edit",
  "leads:assign",
  "clients:view",
  "clients:edit",
  "clients:assign",
  "projects:view",
  "projects:edit",
  "projects:assign",
  "commercial_plans:view",
  "commercial_plans:edit",
  "recurring_services:view",
  "recurring_services:edit",
  "billing:view",
  "payments:manage",
  "billing_settings:manage",
  "finance:view",
  "expenses:view",
  "expenses:create",
  "expenses:reverse",
  "reports:export",
  "modules:view",
  "modules:draft",
  "modules:manage",
  "module_proposals:approve",
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
  "records:delete_empty",
  "records:archive",
  "financial:reverse",
  "mail:use",
  "mail:supervise",
  "mail:assign_threads",
  "mail:manage_templates",
  "mail:manage_identities",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminUser = {
  uid: string;
  email: string;
  role: AdminRole;
  active: true;
  permissions: AdminPermission[];
  displayName?: string;
  preferredName?: string;
  jobTitle?: string;
  profilePhotoPath?: string | null;
};

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  admin: [
    "leads:view",
    "leads:edit",
    "leads:assign",
    "clients:view",
    "clients:edit",
    "clients:assign",
    "projects:view",
    "projects:edit",
    "projects:assign",
    "commercial_plans:view",
    "commercial_plans:edit",
    "recurring_services:view",
    "recurring_services:edit",
    "billing:view",
    "payments:manage",
    "billing_settings:manage",
    "finance:view",
    "expenses:view",
    "expenses:create",
    "expenses:reverse",
    "reports:export",
    "modules:view",
    "modules:draft",
    "modules:manage",
    "module_proposals:approve",
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
    "records:delete_empty",
    "records:archive",
    "financial:reverse",
    "mail:use",
    "mail:supervise",
    "mail:assign_threads",
    "mail:manage_templates",
  ],
  manager: ["leads:view", "leads:edit", "leads:assign", "clients:view", "clients:edit", "clients:assign", "projects:view", "projects:edit", "projects:assign", "commercial_plans:view", "recurring_services:view", "billing:view", "payments:manage", "finance:view", "reports:view", "reports:export", "modules:view", "modules:draft", "modules:manage", "notes:view", "notes:edit", "tasks:view", "tasks:edit", "activity:view", "notifications:view", "notifications:edit", "mail:use", "mail:supervise", "mail:assign_threads", "mail:manage_templates", "records:delete_empty", "records:archive"],
  viewer: ["leads:view", "clients:view", "projects:view", "commercial_plans:view", "recurring_services:view", "billing:view", "modules:view"],
  sales_agent: [
    "leads:view",
    "leads:edit",
    "clients:view",
    "clients:edit",
    "projects:view",
    "projects:edit",
    "commercial_plans:view",
    "recurring_services:view",
    "billing:view",
    "notes:view",
    "notes:edit",
    "tasks:view",
    "tasks:edit",
    "activity:view",
    "notifications:view",
    "notifications:edit",
    "reports:view",
    "modules:view",
    "modules:draft",
    "mail:use",
  ],
};

export type LeadDataScope = "global" | "assigned";

const ROLE_LEAD_SCOPES: Record<AdminRole, LeadDataScope> = {
  owner: "global",
  admin: "global",
  manager: "global",
  viewer: "global",
  sales_agent: "assigned",
};

export type LeadOwnership = {
  assignedToUid?: string | null;
};

export type TaskDataScope = "global" | "assigned" | "none";

const ROLE_TASK_SCOPES: Record<AdminRole, TaskDataScope> = {
  owner: "global",
  admin: "global",
  manager: "global",
  viewer: "none",
  sales_agent: "assigned",
};

export type TaskOwnership = {
  assignedToUid?: string | null;
  leadId?: string | null;
  leadAssignedToUid?: string | null;
};

export type NotificationDataScope = "personal_with_legacy" | "personal" | "none";

const ROLE_NOTIFICATION_SCOPES: Record<AdminRole, NotificationDataScope> = {
  owner: "personal_with_legacy",
  admin: "personal_with_legacy",
  manager: "personal_with_legacy",
  viewer: "none",
  sales_agent: "personal",
};

export type NotificationOwnership = {
  recipientUid?: string | null;
};

export type InvitationStatus = "pending" | "sent" | "failed" | "accepted";

export type AssignmentTargetProfile = {
  role?: unknown;
  active?: unknown;
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export function defaultPermissionsForRole(role: AdminRole): AdminPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function leadDataScopeForRole(role: AdminRole): LeadDataScope {
  return ROLE_LEAD_SCOPES[role];
}

export function leadDataScopeForAdmin(admin: AdminUser): LeadDataScope {
  return leadDataScopeForRole(admin.role);
}

export function canAccessLead(admin: AdminUser, lead: LeadOwnership) {
  if (!admin.active || !hasPermission(admin, "leads:view")) return false;
  return leadDataScopeForAdmin(admin) === "global" || lead.assignedToUid === admin.uid;
}

export function canAssignLead(admin: AdminUser) {
  return hasPermission(admin, "leads:assign") && leadDataScopeForAdmin(admin) === "global";
}

export type CommercialDataScope = "global" | "assigned";

export function commercialDataScopeForAdmin(admin: AdminUser): CommercialDataScope {
  return admin.role === "sales_agent" ? "assigned" : "global";
}

export function canAssignCommercialOwner(admin: AdminUser) {
  return admin.active && (hasPermission(admin, "clients:assign") || hasPermission(admin, "projects:assign"));
}

export function taskDataScopeForAdmin(admin: AdminUser): TaskDataScope {
  return ROLE_TASK_SCOPES[admin.role];
}

export function canAccessTask(admin: AdminUser, task: TaskOwnership) {
  if (!admin.active || !hasPermission(admin, "tasks:view")) return false;
  const scope = taskDataScopeForAdmin(admin);
  if (scope === "global") return true;
  if (scope !== "assigned" || task.assignedToUid !== admin.uid) return false;
  return !task.leadId || task.leadAssignedToUid === admin.uid;
}

export function canAssignTask(admin: AdminUser) {
  return hasPermission(admin, "tasks:edit") && taskDataScopeForAdmin(admin) === "global";
}

export function resolveTaskAssigneeForRequest(admin: AdminUser, requestedUid?: string | null) {
  const normalized = typeof requestedUid === "string" ? requestedUid.trim() : null;
  if (taskDataScopeForAdmin(admin) === "assigned") {
    return normalized && normalized !== admin.uid
      ? { ok: false as const }
      : { ok: true as const, assignedToUid: admin.uid };
  }
  if (!canAssignTask(admin)) return { ok: false as const };
  return { ok: true as const, assignedToUid: normalized || admin.uid };
}

export function isTaskAssigneeProfile(profile: AssignmentTargetProfile) {
  return profile.active === true
    && (profile.role === "owner" || profile.role === "admin" || profile.role === "sales_agent");
}

export function notificationDataScopeForAdmin(admin: AdminUser): NotificationDataScope {
  return ROLE_NOTIFICATION_SCOPES[admin.role];
}

export function canAccessNotification(admin: AdminUser, notification: NotificationOwnership) {
  if (!admin.active || !hasPermission(admin, "notifications:view")) return false;
  const scope = notificationDataScopeForAdmin(admin);
  if (scope === "none") return false;
  if (notification.recipientUid === admin.uid) return true;
  return scope === "personal_with_legacy" && !notification.recipientUid;
}

export function isAssignableSalesAgent(profile: AssignmentTargetProfile) {
  return profile.role === "sales_agent" && profile.active === true;
}

export function resolveLeadAssignmentAction(previousUid: string | null, nextUid: string | null) {
  if (previousUid === nextUid) return "unchanged" as const;
  if (!nextUid) return "unassigned" as const;
  return previousUid ? "reassigned" as const : "assigned" as const;
}

export function parseLeadAssignmentInput(input: unknown): { ok: true; assignedToUid: string | null } | { ok: false } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false };
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !("assignedToUid" in record)) return { ok: false };
  if (record.assignedToUid === null) return { ok: true, assignedToUid: null };
  if (typeof record.assignedToUid !== "string") return { ok: false };
  const assignedToUid = record.assignedToUid.trim();
  return assignedToUid.length >= 1 && assignedToUid.length <= 160
    ? { ok: true, assignedToUid }
    : { ok: false };
}

export function canResendInvitation(profile: { active?: unknown; role?: unknown; invitationStatus?: unknown }) {
  return profile.active === true
    && MANAGEABLE_ADMIN_ROLES.includes(profile.role as ManageableAdminRole)
    && (profile.invitationStatus === "pending" || profile.invitationStatus === "sent" || profile.invitationStatus === "failed");
}

export function invitationDeliveryUpdate(
  sent: boolean,
  reason: string | null | undefined,
  attemptedAt: string,
) {
  return sent
    ? {
        invitationStatus: "sent" as const,
        invitationSentAt: attemptedAt,
        invitationLastSentAt: attemptedAt,
        invitationError: null,
      }
    : {
        invitationStatus: "failed" as const,
        invitationSentAt: null,
        invitationLastSentAt: attemptedAt,
        invitationError: reason || "email_send_failed",
      };
}

export function resolveInvitationProvisioning(profileExists: boolean, firebaseUserExists: boolean) {
  if (profileExists) return "reject_existing_profile" as const;
  return firebaseUserExists ? "reuse_firebase_user" as const : "create_firebase_user" as const;
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

export function isBootstrapOwnerEmail(
  email: string | undefined | null,
  adminEmails: string | undefined | null,
  ownerEmails: string | undefined | null,
) {
  return isEmailInList(email, adminEmails) && isEmailInList(email, ownerEmails);
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
    displayName: typeof input.profile.display_name === "string" && input.profile.display_name.trim()
      ? input.profile.display_name.trim()
      : typeof input.profile.name === "string" ? input.profile.name.trim() : "",
    preferredName: typeof input.profile.preferred_name === "string" ? input.profile.preferred_name : "",
    jobTitle: typeof input.profile.job_title === "string" ? input.profile.job_title : "",
    profilePhotoPath: typeof input.profile.profile_photo_path === "string" ? input.profile.profile_photo_path : null,
  };
}
