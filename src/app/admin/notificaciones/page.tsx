import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createCrmRepositories } from "@/lib/data/repositories";
import { hasPermission } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  }
  if (!hasPermission(admin, "notifications:view")) redirect("/admin/leads");

  const notifications = await (await createCrmRepositories()).notifications.list(admin);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
      <NotificationsPanel initialNotifications={notifications} />
    </AdminChrome>
  );
}
