import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { createCrmRepositories } from "@/lib/data/repositories";
import { hasPermission } from "@/lib/admin/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  }
  if (!hasPermission(admin, "settings:view")) redirect("/admin/leads");
  const repositories = await createCrmRepositories();
  const [notifications, settings] = await Promise.all([repositories.notifications.list(admin), repositories.settings.get()]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
      <AdminSettingsPanel initialSettings={settings} canRunMaintenance={hasPermission(admin, "maintenance:run")} />
    </AdminChrome>
  );
}
