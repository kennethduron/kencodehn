import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listActivityLogs, listLeads, listNotifications, listTasks } from "@/lib/admin/data";
import { hasPermission, leadDataScopeForAdmin } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "reports:view")) redirect("/admin/leads");

  const canViewTasks = hasPermission(admin, "tasks:view");
  const canViewNotifications = hasPermission(admin, "notifications:view");
  const canViewActivity = hasPermission(admin, "activity:view");
  const personalScope = leadDataScopeForAdmin(admin) === "assigned";
  const canViewDashboardActivity = canViewActivity && !personalScope;
  const [leads, tasks, notifications, activity] = await Promise.all([
    listLeads(admin),
    canViewTasks ? listTasks() : Promise.resolve([]),
    canViewNotifications ? listNotifications() : Promise.resolve([]),
    canViewDashboardActivity ? listActivityLogs(undefined, 8) : Promise.resolve([]),
  ]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <AdminDashboard
        leads={leads}
        tasks={tasks}
        notifications={notifications}
        activity={activity}
        canEditLeads={hasPermission(admin, "leads:edit")}
        canCreateTasks={hasPermission(admin, "tasks:edit")}
        canViewTasks={canViewTasks}
        canViewNotifications={canViewNotifications}
        canViewActivity={canViewDashboardActivity}
        personalScope={personalScope}
      />
    </AdminChrome>
  );
}
