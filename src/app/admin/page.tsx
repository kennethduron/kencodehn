import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listActivityLogs, listLeads, listNotifications, listTasks } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }

  const [leads, tasks, notifications, activity] = await Promise.all([listLeads(), listTasks(), listNotifications(), listActivityLogs(undefined, 8)]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <AdminDashboard leads={leads} tasks={tasks} notifications={notifications} activity={activity} />
    </AdminChrome>
  );
}
