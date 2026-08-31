import "server-only";

import { canAssignLead, canAssignTask, canResendInvitation, hasPermission, type ManageableAdminRole } from "@/lib/admin/authorization";
import type { AdminMember, AdminUser, AssignableSalesAgent, TaskAssignee } from "@/lib/admin/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminUserManagementError } from "@/lib/admin/users";
import {
  buildCrmInvitationHandoffLink,
  buildCrmInvitationEmail,
  type CrmInvitationVerificationType,
} from "@/lib/admin/invitation";
import { sendEmail } from "@/lib/email/service";

const inviteRedirect = "https://kencodehn.com/admin/recovery?mode=invite";

async function generateInvitationCredential(
  client: ReturnType<typeof createSupabaseAdminClient>,
  input: { email: string; name: string; type: CrmInvitationVerificationType },
) {
  const result = await client.auth.admin.generateLink({
    type: input.type,
    email: input.email,
    options: { data: { name: input.name }, redirectTo: inviteRedirect },
  });
  const tokenHash = result.data.properties?.hashed_token;
  if (result.error || !result.data.user || !tokenHash) {
    return { error: result.error ?? new Error("Invitation credential was not generated."), user: null, link: null };
  }
  return {
    error: null,
    user: result.data.user,
    link: buildCrmInvitationHandoffLink(tokenHash, input.type),
  };
}

function member(row: Record<string, any>, assignedLeadCount = 0): AdminMember {
  return { uid: String(row.id), name: String(row.display_name || row.name || ""), email: String(row.email ?? ""), role: row.role ?? null, active: row.active === true, createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null, lastLoginAt: row.last_login_at ?? null, invitedAt: row.invited_at ?? null, invitedByUid: row.invited_by ?? null, invitationStatus: row.invitation_status ?? null, invitationLastSentAt: row.invitation_last_sent_at ?? null, assignedLeadCount };
}
function ensureManager(actor: AdminUser) {
  if (!hasPermission(actor, "users:manage")) throw new AdminUserManagementError(403, "No tienes permiso para administrar usuarios.");
}
function ensureOwner(actor: AdminUser) {
  if (actor.role !== "owner") throw new AdminUserManagementError(403, "Solo el Owner puede eliminar miembros definitivamente.");
}

export type MemberDeletionAssessment = {
  canDelete: boolean;
  reason: string;
};

export async function assessSupabaseAdminMemberDeletion(
  uid: string,
  actor: AdminUser,
): Promise<MemberDeletionAssessment> {
  ensureOwner(actor);
  const client = createSupabaseAdminClient();
  const result = await client.rpc("assess_member_permanent_deletion", {
    p_target: uid,
    p_actor: actor.uid,
  });
  if (result.error) throw new AdminUserManagementError(409, "No pudimos comprobar el historial del miembro de forma segura.");
  const assessment = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!assessment) throw new AdminUserManagementError(404, "Miembro no encontrado.");
  return {
    canDelete: assessment.can_delete === true,
    reason: String(assessment.reason || "No pudimos determinar si el miembro puede eliminarse."),
  };
}

export async function deleteSupabaseAdminMemberWithoutHistory(uid: string, actor: AdminUser) {
  ensureOwner(actor);
  const assessment = await assessSupabaseAdminMemberDeletion(uid, actor);
  if (!assessment.canDelete) throw new AdminUserManagementError(409, assessment.reason);
  const client = createSupabaseAdminClient();
  const deleted = await client.auth.admin.deleteUser(uid, false);
  if (deleted.error) {
    throw new AdminUserManagementError(
      409,
      "Este miembro tiene actividad registrada y debe conservarse para mantener el historial de Ken Code. Puede desactivar su acceso.",
    );
  }
  return { uid };
}

export async function listSupabaseAdminMembers() {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("profiles").select("*").order("name");
  if (error) throw new AdminUserManagementError(500, "No se pudo consultar el equipo.");
  return Promise.all((data ?? []).map(async (row) => {
    const { count } = await client.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", row.id);
    return member(row, count ?? 0);
  }));
}
export async function getSupabaseAdminMember(uid: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw new AdminUserManagementError(500, "No se pudo consultar el usuario.");
  if (!data) return null;
  const { count } = await client.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", uid);
  return member(data, count ?? 0);
}
export async function listSupabaseAssignableSalesAgents(actor: AdminUser): Promise<AssignableSalesAgent[]> {
  if (!canAssignLead(actor)) throw new AdminUserManagementError(403, "No tienes permiso para consultar vendedores asignables.");
  return (await listSupabaseAdminMembers()).filter((item) => item.active && item.role === "sales_agent").map(({ uid, name, email }) => ({ uid, name, email }));
}
export async function listSupabaseTaskAssignees(actor: AdminUser): Promise<TaskAssignee[]> {
  return (await listSupabaseAdminMembers()).filter((item) => item.active && (item.role === "owner" || item.role === "admin" || item.role === "sales_agent") && (canAssignTask(actor) || item.uid === actor.uid)).map(({ uid, name, email, role }) => ({ uid, name, email, role: role as TaskAssignee["role"] }));
}
export async function updateSupabaseAdminMember(uid: string, input: { name?: string; role?: ManageableAdminRole; active?: boolean }, actor: AdminUser) {
  ensureManager(actor);
  const { error } = await createSupabaseAdminClient().rpc("admin_update_profile", { p_target: uid, p_changes: input, p_actor: actor.uid });
  if (error) throw new AdminUserManagementError(error.message.includes("not found") ? 404 : 400, "No se pudo actualizar el perfil de forma segura.");
  return getSupabaseAdminMember(uid);
}
export async function inviteSupabaseAdminMember(input: { name: string; email: string; role: ManageableAdminRole }, actor: AdminUser) {
  ensureManager(actor);
  const client = createSupabaseAdminClient();
  const email = input.email.trim().toLowerCase();
  const { data: existing } = await client.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) throw new AdminUserManagementError(409, "Ya existe un miembro del equipo con este correo.");
  const generated = await generateInvitationCredential(client, { type: "invite", email, name: input.name });
  if (generated.error || !generated.user || !generated.link) {
    const status = "status" in (generated.error ?? {}) ? Number((generated.error as { status?: number }).status) : 0;
    throw new AdminUserManagementError(status === 422 ? 409 : 502, "No pudimos preparar la invitación.");
  }
  const { error: provisionError } = await client.rpc("provision_invited_profile", { p_id: generated.user.id, p_email: email, p_name: input.name, p_role: input.role, p_actor: actor.uid });
  if (provisionError) {
    await client.auth.admin.deleteUser(generated.user.id);
    throw new AdminUserManagementError(500, "La invitación se revirtió porque el perfil no pudo provisionarse.");
  }
  const template = buildCrmInvitationEmail(input.name, generated.link);
  const delivery = await sendEmail({
    ...template,
    type: "user_invitation",
    to: email,
    relatedUserUid: generated.user.id,
    idempotencyKey: `user-invitation/${generated.user.id}`,
  });
  if (!delivery.sent) {
    await client.from("profiles").delete().eq("id", generated.user.id);
    await client.auth.admin.deleteUser(generated.user.id);
    throw new AdminUserManagementError(502, "No pudimos enviar la invitación.");
  }
  return { member: await getSupabaseAdminMember(generated.user.id), emailSent: true, emailReason: null };
}
export async function resendSupabaseAdminInvitation(uid: string, actor: AdminUser) {
  ensureManager(actor);
  const client = createSupabaseAdminClient();
  const target = await getSupabaseAdminMember(uid);
  if (!target) throw new AdminUserManagementError(404, "Usuario no encontrado.");
  if (!canResendInvitation(target)) throw new AdminUserManagementError(409, "La invitación no puede reenviarse en su estado actual.");
  const authResult = await client.auth.admin.getUserById(uid);
  const authUser = authResult.data.user;
  if (authResult.error || !authUser || authUser.email?.trim().toLowerCase() !== target.email.trim().toLowerCase()) {
    throw new AdminUserManagementError(409, "La cuenta de acceso no coincide con este miembro del equipo.");
  }
  if (target.lastLoginAt || target.invitationStatus === "accepted") {
    throw new AdminUserManagementError(409, "El usuario ya completó su acceso y no necesita otra invitación.");
  }
  const claimedAt = new Date().toISOString();
  const claim = await client.rpc("claim_invitation_resend", { p_target: uid, p_actor: actor.uid, p_now: claimedAt });
  if (claim.error) {
    if (claim.error.message.includes("cooldown")) throw new AdminUserManagementError(429, "Espere un minuto antes de solicitar otro enlace de acceso.");
    if (claim.error.message.includes("not pending")) throw new AdminUserManagementError(409, "La invitación no puede reenviarse en su estado actual.");
    throw new AdminUserManagementError(409, "No pudimos reservar un nuevo envío de forma segura.");
  }
  const complete = async (sent: boolean, reason?: string | null) => client.rpc("complete_invitation_resend", {
    p_target: uid,
    p_actor: actor.uid,
    p_claimed_at: String(claim.data),
    p_sent: sent,
    p_error: reason ?? null,
  });

  const verificationType: CrmInvitationVerificationType = authUser.email_confirmed_at ? "magiclink" : "invite";
  const generated = await generateInvitationCredential(client, {
    type: verificationType,
    email: target.email,
    name: target.name,
  });
  if (generated.error || !generated.link) {
    await complete(false, verificationType === "invite" ? "auth_invite_failed" : "auth_continuation_failed");
    throw new AdminUserManagementError(502, "No pudimos preparar una nueva invitación.");
  }
  const template = buildCrmInvitationEmail(target.name, generated.link);
  const delivery = await sendEmail({
    ...template,
    type: "user_invitation",
    to: target.email,
    relatedUserUid: uid,
    idempotencyKey: `user-invitation-resend/${uid}/${String(claim.data)}`,
  });
  if (!delivery.sent) {
    await complete(false, delivery.reason);
    throw new AdminUserManagementError(502, "No pudimos reenviar la invitación.");
  }
  const completed = await complete(true);
  if (completed.error) throw new AdminUserManagementError(500, "La invitación se envió pero no pudo registrarse.");
  return { member: await getSupabaseAdminMember(uid), emailSent: true, emailReason: null };
}
