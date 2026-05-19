import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listNotifications } from "@/lib/admin/data";
import { ensureAdminUserProfile, getAdminSettings } from "@/lib/admin/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  await ensureAdminUserProfile(admin);
  const [notifications, settings] = await Promise.all([listNotifications(), getAdminSettings()]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <AdminSettingsPanel initialSettings={settings} />
    </AdminChrome>
  );
}
