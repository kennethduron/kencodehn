import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { FinanceDashboard } from "@/components/admin/finance-dashboard";
import {
  getCurrentAdmin,
  getMissingAdminEnv,
  getMissingAuthClientEnv,
} from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { commercialPageContext } from "@/lib/commercial/page-context";
import {
  financeReport,
  financeSeries,
  financeSummary,
  hasFinanceMovementsOutside,
} from "@/lib/finance/data";
import { resolveFinanceRange } from "@/lib/finance/range";
import { financeAddOnSummary } from "@/lib/add-ons/data";
export const dynamic = "force-dynamic";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  if (!hasPermission(admin, "finance:view")) redirect("/admin");
  const p = await searchParams;
  const value = (key: string) =>
    typeof p[key] === "string" ? (p[key] as string) : undefined;
  const range = resolveFinanceRange({
    period: value("period"),
    from: value("from"),
    to: value("to"),
  });
  const [summary, movements, series, moduleSummary, outsideRange, context] =
    await Promise.all([
      financeSummary(range.from, range.to),
      financeReport({
        report: "cash_result",
        from: range.from,
        to: range.to,
        currency: "USD",
        pageSize: 6,
      }),
      financeSeries(range.from, range.to),
      financeAddOnSummary(range.from, range.to),
      hasFinanceMovementsOutside(range.from, range.to),
      commercialPageContext(admin),
    ]);
  return (
    <AdminChrome
      admin={admin}
      unreadCount={context.unreadCount}
      authProvider={getCrmAuthProvider()}
    >
      <FinanceDashboard
        summary={summary}
        series={{ USD: series }}
        movements={movements.items}
        range={range}
        moduleSummary={moduleSummary}
        hasMovementsOutside={outsideRange}
      />
    </AdminChrome>
  );
}
