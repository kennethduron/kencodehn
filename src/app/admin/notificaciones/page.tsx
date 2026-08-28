import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { NotificationsPanel } from "@/components/admin/notifications-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listNotifications } from "@/lib/admin/data";
import { hasPermission } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "notifications:view")) redirect("/admin/leads");

  const notifications = await listNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <NotificationsPanel initialNotifications={notifications} />
    </AdminChrome>
  );
}
