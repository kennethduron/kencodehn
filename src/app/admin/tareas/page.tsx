import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { TasksPanel } from "@/components/admin/tasks-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { checkOverdueTasks, listLeads, listNotifications, listTasks } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }

  await checkOverdueTasks(admin);
  const [tasks, leads, notifications] = await Promise.all([listTasks(), listLeads(), listNotifications()]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <TasksPanel initialTasks={tasks} leads={leads} />
    </AdminChrome>
  );
}
