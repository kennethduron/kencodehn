import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { LeadDetail } from "@/components/admin/lead-detail";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { canAssignLead, hasPermission } from "@/lib/admin/authorization";
import { createCrmRepositories } from "@/lib/data/repositories";

export const dynamic = "force-dynamic";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  }
  if (!hasPermission(admin, "leads:view")) {
    redirect("/admin");
  }

  const { id } = await params;
  const canViewNotes = hasPermission(admin, "notes:view");
  const canViewTasks = hasPermission(admin, "tasks:view");
  const canViewActivity = hasPermission(admin, "activity:view");
  const mayAssignLead = canAssignLead(admin);
  const repositories = await createCrmRepositories();
  const lead = await repositories.leads.get(id, admin);
  if (!lead) {
    notFound();
  }
  const [notes, tasks, activity, notifications, assignableUsers] = await Promise.all([
    canViewNotes ? repositories.notes.list(id, admin) : Promise.resolve([]),
    canViewTasks ? repositories.tasks.list(admin, id) : Promise.resolve([]),
    canViewActivity ? repositories.activity.list(admin, id) : Promise.resolve([]),
    hasPermission(admin, "notifications:view") ? repositories.notifications.list(admin) : Promise.resolve([]),
    mayAssignLead ? repositories.users.list().then((members) => members.filter((member) => member.active && member.role === "sales_agent").map(({ uid, name, email }) => ({ uid, name, email }))) : Promise.resolve([]),
  ]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
      <LeadDetail
        initialLead={lead}
        initialNotes={notes}
        initialTasks={tasks}
        initialActivity={activity}
        canEditLead={hasPermission(admin, "leads:edit")}
        canViewNotes={canViewNotes}
        canEditNotes={hasPermission(admin, "notes:edit")}
        canViewTasks={canViewTasks}
        canEditTasks={hasPermission(admin, "tasks:edit")}
        canViewActivity={canViewActivity}
        canDeleteLead={hasPermission(admin, "maintenance:run")}
        canAssignLead={mayAssignLead}
        assignableUsers={assignableUsers}
      />
    </AdminChrome>
  );
}
