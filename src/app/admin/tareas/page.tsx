import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { TasksPanel } from "@/components/admin/tasks-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listLeads, listNotifications, listTasks } from "@/lib/admin/data";
import { hasPermission } from "@/lib/admin/authorization";
import { canAssignTask } from "@/lib/admin/authorization";
import { listTaskAssignees } from "@/lib/admin/users";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "tasks:view")) redirect("/admin/leads");

  const [tasks, leads, notifications, assignees] = await Promise.all([listTasks(admin), listLeads(admin), listNotifications(admin), listTaskAssignees(admin)]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <TasksPanel
        initialTasks={tasks}
        leads={leads}
        assignees={assignees}
        currentUserUid={admin.uid}
        canAssign={canAssignTask(admin)}
        canDelete={hasPermission(admin, "tasks:delete")}
      />
    </AdminChrome>
  );
}
