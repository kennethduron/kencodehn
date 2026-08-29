import "server-only";

import { canAssignCommercialOwner, hasPermission, type AdminUser } from "@/lib/admin/authorization";
import { listSupabaseAdminMembers } from "@/lib/admin/supabase-users";
import { createCrmRepositories } from "@/lib/data/repositories";

export async function commercialPageContext(admin: AdminUser) {
  const repositories = await createCrmRepositories();
  const [notifications, members] = await Promise.all([
    hasPermission(admin, "notifications:view") ? repositories.notifications.list(admin) : Promise.resolve([]),
    canAssignCommercialOwner(admin)
      ? listSupabaseAdminMembers().then((items) => items.filter((item) => item.active && item.role === "sales_agent"))
      : Promise.resolve(admin.role === "sales_agent" ? [{ uid: admin.uid, name: "", email: admin.email, role: admin.role, active: true as const, createdAt: null, updatedAt: null, lastLoginAt: null, invitedAt: null, invitedByUid: null, invitationStatus: null, invitationLastSentAt: null, assignedLeadCount: 0 }] : []),
  ]);
  return { unreadCount: notifications.filter((item) => !item.read).length, members };
}
