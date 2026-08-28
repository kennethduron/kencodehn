import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { TeamPanel } from "@/components/admin/team-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { hasPermission } from "@/lib/admin/authorization";
import { createCrmRepositories } from "@/lib/data/repositories";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  }
  if (!hasPermission(admin, "users:manage")) redirect("/admin");

  const repositories = await createCrmRepositories();
  const [members, notifications] = await Promise.all([repositories.users.list(), repositories.notifications.list(admin)]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount} authProvider={getCrmAuthProvider()}>
      <TeamPanel initialMembers={members} currentUserUid={admin.uid} />
    </AdminChrome>
  );
}
