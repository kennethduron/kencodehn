import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminDashboard } from "@/components/admin/dashboard";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createCrmRepositories } from "@/lib/data/repositories";
import { hasPermission, leadDataScopeForAdmin } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";
import { listCommercialClients, listCommercialProjects } from "@/lib/commercial/data";
import { billingSummary } from "@/lib/billing/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  if (!hasPermission(admin, "reports:view")) redirect("/admin/leads");

  const canViewTasks = hasPermission(admin, "tasks:view");
  const canViewNotifications = hasPermission(admin, "notifications:view");
  const canViewActivity = hasPermission(admin, "activity:view");
  const personalScope = leadDataScopeForAdmin(admin) === "assigned";
  const canViewDashboardActivity = canViewActivity;
  const repositories = await createCrmRepositories();
  const [leads, tasks, notifications, activity, clients, projects, billing] = await Promise.all([
    repositories.leads.list(admin),
    canViewTasks ? repositories.tasks.list(admin) : Promise.resolve([]),
    canViewNotifications ? repositories.notifications.list(admin) : Promise.resolve([]),
    canViewDashboardActivity ? repositories.activity.list(admin, undefined, 8) : Promise.resolve([]),
    hasPermission(admin, "clients:view") ? listCommercialClients() : Promise.resolve([]),
    hasPermission(admin, "projects:view") ? listCommercialProjects() : Promise.resolve([]),
    hasPermission(admin, "billing:view") ? billingSummary() : Promise.resolve([]),
  ]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
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
        clients={clients}
        projects={projects}
        billingSummary={billing}
      />
    </AdminChrome>
  );
}
