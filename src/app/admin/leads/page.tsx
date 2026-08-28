import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { LeadList } from "@/components/admin/lead-list";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listLeads, listNotifications } from "@/lib/admin/data";
import { canAssignLead, hasPermission } from "@/lib/admin/authorization";
import { listAssignableSalesAgents } from "@/lib/admin/users";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "leads:view")) redirect("/admin");

  const mayAssignLeads = canAssignLead(admin);
  const [leads, notifications, assignableUsers] = await Promise.all([
    listLeads(admin),
    hasPermission(admin, "notifications:view") ? listNotifications(admin) : Promise.resolve([]),
    mayAssignLeads ? listAssignableSalesAgents(admin) : Promise.resolve([]),
  ]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Leads</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Solicitudes y oportunidades</h1>
        </div>
        <LeadList initialLeads={leads} canEdit={hasPermission(admin, "leads:edit")} canCreateTasks={hasPermission(admin, "tasks:edit")} canAssign={mayAssignLeads} assignableUsers={assignableUsers} />
      </div>
    </AdminChrome>
  );
}
