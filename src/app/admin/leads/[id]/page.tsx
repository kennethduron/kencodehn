import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { LeadDetail } from "@/components/admin/lead-detail";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getLead, listActivityLogs, listNotes, listNotifications, listTasks } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "leads:view")) {
    redirect("/admin");
  }

  const { id } = await params;
  const canViewNotes = hasPermission(admin, "notes:view");
  const canViewTasks = hasPermission(admin, "tasks:view");
  const canViewActivity = hasPermission(admin, "activity:view");
  const [lead, notes, tasks, activity, notifications] = await Promise.all([
    getLead(id),
    canViewNotes ? listNotes(id) : Promise.resolve([]),
    canViewTasks ? listTasks(id) : Promise.resolve([]),
    canViewActivity ? listActivityLogs(id) : Promise.resolve([]),
    hasPermission(admin, "notifications:view") ? listNotifications() : Promise.resolve([]),
  ]);
  if (!lead) {
    notFound();
  }
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
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
      />
    </AdminChrome>
  );
}
