import { notFound } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { LeadDetail } from "@/components/admin/lead-detail";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { getLead, listActivityLogs, listNotes, listNotifications, listTasks } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }

  const { id } = await params;
  const [lead, notes, tasks, activity, notifications] = await Promise.all([getLead(id), listNotes(id), listTasks(id), listActivityLogs(id), listNotifications()]);
  if (!lead) {
    notFound();
  }
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <LeadDetail initialLead={lead} initialNotes={notes} initialTasks={tasks} initialActivity={activity} />
    </AdminChrome>
  );
}
