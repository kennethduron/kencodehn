import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { TeamPanel } from "@/components/admin/team-panel";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { listNotifications } from "@/lib/admin/data";
import { listAdminMembers } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }
  if (!hasPermission(admin, "users:manage")) redirect("/admin");

  const [members, notifications] = await Promise.all([listAdminMembers(), listNotifications(admin)]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <TeamPanel initialMembers={members} currentUserUid={admin.uid} />
    </AdminChrome>
  );
}
