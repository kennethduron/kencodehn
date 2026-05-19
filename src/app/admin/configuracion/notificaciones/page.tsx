import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { PushSettings } from "@/components/admin/push-settings";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listNotifications } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminNotificationSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  const notifications = await listNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <PushSettings />
    </AdminChrome>
  );
}
