import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { TasksPanel } from "@/components/admin/tasks-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createCrmRepositories } from "@/lib/data/repositories";
import { hasPermission } from "@/lib/admin/authorization";
import { canAssignTask } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  }
  if (!hasPermission(admin, "tasks:view")) redirect("/admin/leads");

  const repositories = await createCrmRepositories();
  const [tasks, leads, notifications, members] = await Promise.all([repositories.tasks.list(admin), repositories.leads.list(admin), repositories.notifications.list(admin), repositories.users.list()]);
  const assignees = members
    .filter((member) => member.active && (member.role === "owner" || member.role === "admin" || member.role === "sales_agent"))
    .filter((member) => canAssignTask(admin) || member.uid === admin.uid)
    .map(({ uid, name, email, role }) => ({ uid, name, email, role: role as "owner" | "admin" | "sales_agent" }));
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
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
