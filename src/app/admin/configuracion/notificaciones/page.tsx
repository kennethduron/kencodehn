import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { PushSettings } from "@/components/admin/push-settings";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createCrmRepositories } from "@/lib/data/repositories";
import { notificationEventsForRole } from "@/lib/notifications/preferences";

export const dynamic = "force-dynamic";

export default async function AdminNotificationSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  const notifications = hasPermission(admin, "notifications:view")
    ? await (await createCrmRepositories()).notifications.list(admin)
    : [];
  return (
    <AdminChrome admin={admin} unreadCount={notifications.filter((notification) => !notification.read).length} authProvider={getCrmAuthProvider()}>
      <PushSettings availableEvents={notificationEventsForRole(admin.role)} />
    </AdminChrome>
  );
}
