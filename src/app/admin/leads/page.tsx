import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { LeadList } from "@/components/admin/lead-list";
import { getCurrentAdmin, getMissingAdminEnv, getMissingFirebaseClientEnv } from "@/lib/admin/auth";
import { listLeads, listNotifications } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return <AdminLogin missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingFirebaseClientEnv()} />;
  }

  const [leads, notifications] = await Promise.all([listLeads(), listNotifications()]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <AdminChrome admin={admin} unreadCount={unreadCount}>
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Leads</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Solicitudes y oportunidades</h1>
        </div>
        <LeadList initialLeads={leads} />
      </div>
    </AdminChrome>
  );
}
