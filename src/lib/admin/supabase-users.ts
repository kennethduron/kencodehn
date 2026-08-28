import "server-only";

import { canAssignLead, canAssignTask, canResendInvitation, hasPermission, type ManageableAdminRole } from "@/lib/admin/authorization";
import type { AdminMember, AdminUser, AssignableSalesAgent, TaskAssignee } from "@/lib/admin/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminUserManagementError } from "@/lib/admin/users";

const inviteRedirect = "https://kencodehn.com/auth/callback?next=%2Fadmin%2Frecovery%3Finvitation%3D1";

function member(row: Record<string, any>, assignedLeadCount = 0): AdminMember {
  return { uid: String(row.id), name: String(row.name ?? ""), email: String(row.email ?? ""), role: row.role ?? null, active: row.active === true, createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null, lastLoginAt: row.last_login_at ?? null, invitedAt: row.invited_at ?? null, invitedByUid: row.invited_by ?? null, invitationStatus: row.invitation_status ?? null, invitationLastSentAt: row.invitation_last_sent_at ?? null, assignedLeadCount };
}
function ensureManager(actor: AdminUser) {
  if (!hasPermission(actor, "users:manage")) throw new AdminUserManagementError(403, "No tienes permiso para administrar usuarios.");
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
  if (existing) throw new AdminUserManagementError(409, "Ya existe un perfil CRM para este correo.");
  const { data, error } = await client.auth.admin.inviteUserByEmail(email, { data: { name: input.name }, redirectTo: inviteRedirect });
  if (error || !data.user) throw new AdminUserManagementError(error?.status === 422 ? 409 : 502, "Supabase Auth no pudo enviar la invitación.");
  const { error: provisionError } = await client.rpc("provision_invited_profile", { p_id: data.user.id, p_email: email, p_name: input.name, p_role: input.role, p_actor: actor.uid });
  if (provisionError) {
    await client.auth.admin.deleteUser(data.user.id);
    throw new AdminUserManagementError(500, "La invitación se revirtió porque el perfil no pudo provisionarse.");
  }
  return { member: await getSupabaseAdminMember(data.user.id), emailSent: true, emailReason: null };
}
export async function resendSupabaseAdminInvitation(uid: string, actor: AdminUser) {
  ensureManager(actor);
  const client = createSupabaseAdminClient();
  const target = await getSupabaseAdminMember(uid);
  if (!target) throw new AdminUserManagementError(404, "Usuario no encontrado.");
  if (!canResendInvitation(target)) throw new AdminUserManagementError(409, "La invitación no puede reenviarse en su estado actual.");
  const { error } = await client.auth.resend({ type: "signup", email: target.email, options: { emailRedirectTo: inviteRedirect } });
  if (error) throw new AdminUserManagementError(502, "Supabase Auth no pudo reenviar la invitación.");
  const { error: recordError } = await client.rpc("record_invitation_resent", { p_target: uid, p_actor: actor.uid });
  if (recordError) throw new AdminUserManagementError(500, "La invitación se envió pero no pudo registrarse.");
  return { member: await getSupabaseAdminMember(uid), emailSent: true, emailReason: null };
}
