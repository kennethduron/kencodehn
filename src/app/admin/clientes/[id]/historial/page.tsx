import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { HistoricalImportWizard } from "@/components/admin/historical-import-wizard";
import {
  getCurrentAdmin,
  getMissingAdminEnv,
  getMissingAuthClientEnv,
} from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listClientAddOns } from "@/lib/add-ons/data";
import { listReceivables } from "@/lib/billing/data";
import { getCommercialClient } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
import { getActiveHistoricalImport } from "@/lib/historical-import/data";
import { todayInHonduras } from "@/lib/time";
export const dynamic = "force-dynamic";
export default async function HistoricalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return (
      <AdminLogin
        authProvider={getCrmAuthProvider()}
        missingServerEnv={getMissingAdminEnv()}
        missingClientEnv={getMissingAuthClientEnv()}
      />
    );
  if (admin.role !== "owner" && admin.role !== "admin") redirect("/admin");
  const { id } = await params;
  const [detail, context, addOns, receivables, session] = await Promise.all([
    getCommercialClient(id),
    commercialPageContext(admin),
    listClientAddOns(id),
    listReceivables({ clientId: id, pageSize: 50 }),
    getActiveHistoricalImport(id),
  ]);
  if (!detail) notFound();
  return (
    <AdminChrome
      admin={admin}
      unreadCount={context.unreadCount}
      authProvider={getCrmAuthProvider()}
    >
      <HistoricalImportWizard
        client={detail.client}
        projects={detail.projects}
        addOns={addOns}
        receivables={receivables.items}
        session={session}
        today={todayInHonduras()}
      />
    </AdminChrome>
  );
}
