import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listNotifications } from "@/lib/admin/data";
import { getAdminSettings } from "@/lib/admin/settings";
import { hasPermission } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "settings:view")) redirect("/admin/leads");
  const [notifications, settings] = await Promise.all([listNotifications(admin), getAdminSettings()]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <AdminSettingsPanel initialSettings={settings} canRunMaintenance={hasPermission(admin, "maintenance:run")} />
    </AdminChrome>
  );
}
