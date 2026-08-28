import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { LeadList } from "@/components/admin/lead-list";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createCrmRepositories } from "@/lib/data/repositories";
import { canAssignLead, hasPermission } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  }
  if (!hasPermission(admin, "leads:view")) redirect("/admin");

  const mayAssignLeads = canAssignLead(admin);
  const repositories = await createCrmRepositories();
  const [leads, notifications, assignableUsers] = await Promise.all([
    repositories.leads.list(admin),
    hasPermission(admin, "notifications:view") ? repositories.notifications.list(admin) : Promise.resolve([]),
    mayAssignLeads ? repositories.users.list().then((members) => members.filter((member) => member.active && member.role === "sales_agent").map(({ uid, name, email }) => ({ uid, name, email }))) : Promise.resolve([]),
  ]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
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
