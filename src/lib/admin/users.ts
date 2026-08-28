import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
  defaultPermissionsForRole,
  canAssignLead,
  canResendInvitation,
  hasPermission,
  invitationDeliveryUpdate,
  isAdminRole,
  MANAGEABLE_ADMIN_ROLES,
  resolveInvitationProvisioning,
  type AdminRole,
  type ManageableAdminRole,
} from "@/lib/admin/authorization";
import { addActivityLog } from "@/lib/admin/data";
import { buildCrmInvitationEmail } from "@/lib/admin/invitation";
import type { AdminMember, AdminUser, AssignableSalesAgent } from "@/lib/admin/types";
import { sendEmail } from "@/lib/email/service";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { site } from "@/lib/site";

export class AdminUserManagementError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdminUserManagementError";
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

function mapAdminMember(doc: QueryDocumentSnapshot<DocumentData>, assignedLeadCount = 0): AdminMember {
  const data = doc.data();
  const rawInvitationStatus = data.invitationStatus === "email_failed" ? "failed" : data.invitationStatus;
  return {
    uid: doc.id,
    name: String(data.name ?? data.displayName ?? "").trim(),
    email: String(data.email ?? "").trim().toLowerCase(),
    role: isAdminRole(data.role) ? data.role : null,
    active: data.active !== false,
    createdAt: toIso(data.createdAt ?? data.bootstrapCreatedAt),
    updatedAt: toIso(data.updatedAt),
    lastLoginAt: toIso(data.lastLoginAt),
    invitedAt: toIso(data.invitedAt),
    invitedByUid: data.invitedByUid ? String(data.invitedByUid) : null,
    invitationStatus: rawInvitationStatus === "pending" || rawInvitationStatus === "sent" || rawInvitationStatus === "failed" || rawInvitationStatus === "accepted" ? rawInvitationStatus : null,
    invitationLastSentAt: toIso(data.invitationLastSentAt ?? data.invitationSentAt),
    assignedLeadCount,
  };
}

async function countAssignedLeads(uid: string) {
  const db = getAdminDb();
  if (!db) return 0;
  const snapshot = await db.collection("leads").where("assignedToUid", "==", uid).count().get();
  return snapshot.data().count;
}

export async function listAdminMembers() {
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("adminUsers").limit(200).get();
  const counts = await Promise.all(snapshot.docs.map((doc) => countAssignedLeads(doc.id)));
  return snapshot.docs
    .map((doc, index) => mapAdminMember(doc, counts[index]))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}

export async function listAssignableSalesAgents(actor: AdminUser): Promise<AssignableSalesAgent[]> {
  if (!canAssignLead(actor)) throw new AdminUserManagementError(403, "No tienes permiso para consultar vendedores asignables.");
  const db = getAdminDb();
  if (!db) return [];
  const snapshot = await db.collection("adminUsers").where("role", "==", "sales_agent").limit(200).get();
  return snapshot.docs
    .filter((doc) => doc.data().active === true)
    .map((doc) => ({
      uid: doc.id,
      name: String(doc.data().name ?? doc.data().displayName ?? "").trim(),
      email: String(doc.data().email ?? "").trim().toLowerCase(),
    }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}

export async function getAdminMember(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  const snapshot = await db.collection("adminUsers").doc(uid).get();
  if (!snapshot.exists) return null;
  const count = await countAssignedLeads(uid);
  return mapAdminMember(snapshot as QueryDocumentSnapshot<DocumentData>, count);
}

function ensureUsersManager(actor: AdminUser) {
  if (!hasPermission(actor, "users:manage")) {
    throw new AdminUserManagementError(403, "No tienes permiso para administrar usuarios.");
  }
}

function isManageableRole(role: unknown): role is ManageableAdminRole {
  return typeof role === "string" && MANAGEABLE_ADMIN_ROLES.includes(role as ManageableAdminRole);
}

export async function updateAdminMember(
  uid: string,
  input: { name?: string; role?: ManageableAdminRole; active?: boolean },
  actor: AdminUser,
) {
  ensureUsersManager(actor);
  const db = getAdminDb();
  if (!db) throw new AdminUserManagementError(500, "Firebase Admin no esta configurado.");
  if (uid === actor.uid && (input.role !== undefined || input.active === false)) {
    throw new AdminUserManagementError(400, "No puedes cambiar tu propio rol ni desactivar tu propia cuenta.");
  }
  if (input.role !== undefined && !isManageableRole(input.role)) {
    throw new AdminUserManagementError(400, "Rol no permitido.");
  }

  const ref = db.collection("adminUsers").doc(uid);
  const now = new Date().toISOString();
  const roleActivityRef = db.collection("activityLogs").doc();
  const statusActivityRef = db.collection("activityLogs").doc();
  let previousRole: AdminRole | null = null;
  let previousActive = true;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AdminUserManagementError(404, "Usuario no encontrado.");
    const data = snapshot.data() ?? {};
    previousRole = isAdminRole(data.role) ? data.role : null;
    previousActive = data.active !== false;
    if (previousRole === "owner" && (input.role !== undefined || input.active === false)) {
      throw new AdminUserManagementError(400, "El Owner no puede cambiarse o desactivarse desde la gestion ordinaria.");
    }

    const updates: Record<string, unknown> = { updatedAt: now, updatedByUid: actor.uid, updatedByEmail: actor.email };
    if (input.name !== undefined) updates.name = input.name;
    if (input.role !== undefined) {
      updates.role = input.role;
      updates.permissions = defaultPermissionsForRole(input.role);
    }
    if (input.active !== undefined) updates.active = input.active;
    transaction.set(ref, updates, { merge: true });
    if (input.role !== undefined && input.role !== previousRole) {
      transaction.create(roleActivityRef, {
        entityType: "user",
        entityId: uid,
        leadId: null,
        action: "user_role_changed",
        title: "Rol de usuario actualizado",
        description: `Rol cambiado de ${previousRole || "sin rol"} a ${input.role}.`,
        before: { role: previousRole },
        after: { previousRole, newRole: input.role },
        userUid: actor.uid,
        userEmail: actor.email,
        actorUid: actor.uid,
        targetUid: uid,
        createdAt: now,
        timestamp: now,
      });
    }
    if (input.active !== undefined && input.active !== previousActive) {
      transaction.create(statusActivityRef, {
        entityType: "user",
        entityId: uid,
        leadId: null,
        action: input.active ? "user_activated" : "user_deactivated",
        title: input.active ? "Usuario activado" : "Usuario desactivado",
        description: input.active ? "El acceso del usuario fue activado." : "El acceso del usuario fue desactivado.",
        before: { active: previousActive },
        after: { active: input.active },
        userUid: actor.uid,
        userEmail: actor.email,
        actorUid: actor.uid,
        targetUid: uid,
        createdAt: now,
        timestamp: now,
      });
    }
  });

  const auth = getAdminAuth();
  if (auth && input.name !== undefined) {
    try {
      await auth.updateUser(uid, { displayName: input.name || undefined });
    } catch (error) {
      console.warn("[Ken Code CRM user display name warning]", error);
    }
  }

  return getAdminMember(uid);
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "";
}

async function sendInvitationEmail(input: { uid: string; name: string; email: string }) {
  const auth = getAdminAuth();
  if (!auth) throw new AdminUserManagementError(500, "Firebase Admin no esta configurado.");
  let credentialLink: string;
  try {
    credentialLink = await auth.generatePasswordResetLink(input.email, {
      url: `https://${site.domain}/admin`,
      handleCodeInApp: false,
    });
  } catch (error) {
    console.warn("[Ken Code CRM invitation link warning]", firebaseErrorCode(error) || "firebase_link_failed");
    return { sent: false as const, reason: "firebase_link_failed" };
  }
  const template = buildCrmInvitationEmail(input.name, credentialLink);
  return sendEmail({
    ...template,
    type: "user_invitation",
    to: input.email,
    relatedUserUid: input.uid,
  });
}

export async function inviteAdminMember(
  input: { name: string; email: string; role: ManageableAdminRole },
  actor: AdminUser,
) {
  ensureUsersManager(actor);
  if (!isManageableRole(input.role)) throw new AdminUserManagementError(400, "Rol no permitido.");
  const db = getAdminDb();
  const auth = getAdminAuth();
  if (!db || !auth) throw new AdminUserManagementError(500, "Firebase Admin no esta configurado.");

  const email = input.email.trim().toLowerCase();
  const existingProfiles = await db.collection("adminUsers").where("email", "==", email).limit(1).get();
  if (resolveInvitationProvisioning(!existingProfiles.empty, false) === "reject_existing_profile") {
    throw new AdminUserManagementError(409, "Ya existe un perfil CRM para este correo. Usa la accion de reenvio si la invitacion sigue pendiente.");
  }

  let authUser;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code !== "auth/user-not-found") throw error;
    try {
      authUser = await auth.createUser({ email, displayName: input.name, emailVerified: false, disabled: false });
    } catch (createError) {
      if (firebaseErrorCode(createError) !== "auth/email-already-exists") throw createError;
      authUser = await auth.getUserByEmail(email);
    }
  }
  if (authUser.disabled) throw new AdminUserManagementError(409, "El usuario de Firebase Auth esta desactivado.");

  const ref = db.collection("adminUsers").doc(authUser.uid);
  if ((await ref.get()).exists) throw new AdminUserManagementError(409, "Este usuario ya tiene un perfil CRM.");
  const now = new Date().toISOString();
  try {
    await ref.create({
      uid: authUser.uid,
      name: input.name,
      email,
      role: input.role,
      permissions: defaultPermissionsForRole(input.role),
      active: true,
      invitationStatus: "pending",
      invitedAt: now,
      invitedByUid: actor.uid,
      invitedByEmail: actor.email,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code === "6" || code === "already-exists") throw new AdminUserManagementError(409, "Este usuario ya tiene un perfil CRM.");
    throw error;
  }

  const emailResult = await sendInvitationEmail({ uid: authUser.uid, name: input.name, email });
  const attemptedAt = new Date().toISOString();
  await ref.set({ ...invitationDeliveryUpdate(emailResult.sent, emailResult.reason, attemptedAt), updatedAt: attemptedAt }, { merge: true });
  await addActivityLog({
    entityType: "user",
    entityId: authUser.uid,
    leadId: null,
    action: "user_invited",
    before: null,
    after: { role: input.role, emailSent: emailResult.sent },
    userUid: actor.uid,
    userEmail: actor.email,
    actorUid: actor.uid,
    targetUid: authUser.uid,
  });

  return { member: await getAdminMember(authUser.uid), emailSent: emailResult.sent, emailReason: emailResult.reason ?? null };
}

export async function resendAdminInvitation(uid: string, actor: AdminUser) {
  ensureUsersManager(actor);
  const db = getAdminDb();
  const auth = getAdminAuth();
  if (!db || !auth) throw new AdminUserManagementError(500, "Firebase Admin no esta configurado.");

  const ref = db.collection("adminUsers").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AdminUserManagementError(404, "Usuario no encontrado.");
  const profile = snapshot.data() ?? {};
  const normalizedStatus = profile.invitationStatus === "email_failed" ? "failed" : profile.invitationStatus;
  if (!canResendInvitation({ ...profile, invitationStatus: normalizedStatus })) {
    throw new AdminUserManagementError(409, "La invitacion no puede reenviarse en su estado actual.");
  }

  let authUser;
  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    if (firebaseErrorCode(error) === "auth/user-not-found") {
      throw new AdminUserManagementError(409, "El perfil no tiene un usuario de Firebase Auth asociado.");
    }
    throw error;
  }
  if (authUser.disabled) throw new AdminUserManagementError(409, "El usuario de Firebase Auth esta desactivado.");
  const email = String(authUser.email ?? "").trim().toLowerCase();
  const profileEmail = String(profile.email ?? "").trim().toLowerCase();
  if (!email || !profileEmail || email !== profileEmail) {
    throw new AdminUserManagementError(409, "La identidad de Firebase no coincide con el perfil CRM.");
  }

  const emailResult = await sendInvitationEmail({
    uid,
    name: String(profile.name ?? authUser.displayName ?? "Miembro del equipo").trim(),
    email,
  });
  const attemptedAt = new Date().toISOString();
  await ref.set({
    ...invitationDeliveryUpdate(emailResult.sent, emailResult.reason, attemptedAt),
    invitationLastSentByUid: actor.uid,
    invitationLastSentByEmail: actor.email,
    updatedAt: attemptedAt,
  }, { merge: true });
  await addActivityLog({
    entityType: "user",
    entityId: uid,
    leadId: null,
    action: "user_invitation_resent",
    before: { invitationStatus: normalizedStatus },
    after: { invitationStatus: emailResult.sent ? "sent" : "failed", emailSent: emailResult.sent },
    userUid: actor.uid,
    userEmail: actor.email,
    actorUid: actor.uid,
    targetUid: uid,
  });
  return { member: await getAdminMember(uid), emailSent: emailResult.sent, emailReason: emailResult.reason ?? null };
}
