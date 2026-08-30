import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { FinanceNav,FinancePageHeader } from "@/components/admin/finance-nav";
import { FinanceReportFilters,FinanceReportTable,type ReportFilters } from "@/components/admin/finance-report-table";
import { getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listCommercialClients,listCommercialProjects } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
import { financeReport,listExpenseCategories } from "@/lib/finance/data";
import { resolveFinanceRange } from "@/lib/finance/range";
import type { FinanceReportType } from "@/lib/finance/types";

const reports=["collections","receivables","overdue","expenses","cash_result","project_sales","seller"];
export const dynamic="force-dynamic";
export default async function ReportsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"finance:view"))redirect("/admin");const p=await searchParams;const value=(key:string)=>typeof p[key]==="string"?p[key] as string:undefined;const range=resolveFinanceRange({period:value("period"),from:value("from"),to:value("to")});const report=(reports.includes(value("report")||"")?value("report"):"collections") as FinanceReportType;const filters:ReportFilters={report,...range,currency:"USD",clientId:value("clientId"),projectId:value("projectId"),sellerId:value("sellerId"),paymentMethod:value("paymentMethod"),categoryId:value("categoryId"),page:Number(value("page")||1)};const[result,clients,projects,categories,context]=await Promise.all([financeReport(filters),listCommercialClients(),listCommercialProjects(),listExpenseCategories(),commercialPageContext(admin)]);return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><FinancePageHeader title="Reportes financieros" description="Reportes USD filtrados y paginados en servidor, con exportacion autorizada."/><FinanceNav active="reports"/><FinanceReportFilters filters={filters} clients={clients} projects={projects} members={context.members} categories={categories}/><FinanceReportTable rows={result.items} total={result.total} page={result.page} pageSize={result.pageSize} filters={filters} canExport={hasPermission(admin,"reports:export")}/></div></AdminChrome>}
