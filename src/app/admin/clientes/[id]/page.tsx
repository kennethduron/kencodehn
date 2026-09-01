import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ClientDetail } from "@/components/admin/client-detail";
import { ModuleSummary } from "@/components/admin/module-summary";
import {
  canAssignCommercialOwner,
  hasPermission,
} from "@/lib/admin/authorization";
import {
  getCurrentAdmin,
  getMissingAdminEnv,
  getMissingAuthClientEnv,
} from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import {
  getClientFinancialOverview,
  getCommercialClient,
} from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
import { listPayments, listReceivables } from "@/lib/billing/data";
import { listClientAddOns } from "@/lib/add-ons/data";
import { inspectRecordLifecycle } from "@/lib/lifecycle/data";
import { LifecycleActions } from "@/components/admin/lifecycle-actions";
export const dynamic = "force-dynamic";
export default async function ClientPage({
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
  if (!hasPermission(admin, "clients:view")) redirect("/admin");
  const { id } = await params;
  const [detail, context, receivables, payments, addOns, financialOverview, lifecycle] =
    await Promise.all([
      getCommercialClient(id),
      commercialPageContext(admin),
      listReceivables({ clientId: id, pageSize: 50 }),
      listPayments(id),
      listClientAddOns(id),
      getClientFinancialOverview(id),
      hasPermission(admin, "records:archive") ? inspectRecordLifecycle("client", id) : Promise.resolve(null),
    ]);
  if (!detail) notFound();
  return (
    <AdminChrome
      admin={admin}
      unreadCount={context.unreadCount}
      authProvider={getCrmAuthProvider()}
    >
      <div className="grid gap-5">
        {lifecycle ? <div className="flex justify-end"><LifecycleActions entity="client" id={id} name={detail.client.company || detail.client.name} info={lifecycle} returnTo="/admin/clientes" /></div> : null}
        <ClientDetail
          {...detail}
          billingReceivables={receivables.items}
          billingPayments={payments}
          financialOverview={financialOverview}
          members={context.members}
          canEdit={hasPermission(admin, "clients:edit")}
          canAssign={canAssignCommercialOwner(admin)}
          canManageBilling={hasPermission(admin, "billing_settings:manage")}
          canRegisterHistory={admin.role === "owner" || admin.role === "admin"}
        />
        <ModuleSummary items={addOns} />
      </div>
    </AdminChrome>
  );
}
