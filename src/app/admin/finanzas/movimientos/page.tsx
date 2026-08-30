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

export const dynamic="force-dynamic";
export default async function MovementsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"finance:view"))redirect("/admin");const p=await searchParams;const value=(key:string)=>typeof p[key]==="string"?p[key] as string:undefined;const range=resolveFinanceRange({period:value("period"),from:value("from"),to:value("to")});const filters:ReportFilters={report:"cash_result",...range,currency:"USD",clientId:value("clientId"),projectId:value("projectId"),sellerId:value("sellerId"),paymentMethod:value("paymentMethod"),categoryId:value("categoryId"),page:Number(value("page")||1)};const[result,clients,projects,categories,context]=await Promise.all([financeReport(filters),listCommercialClients(),listCommercialProjects(),listExpenseCategories(),commercialPageContext(admin)]);return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><FinancePageHeader title="Movimientos" description="Vista USD unificada de pagos recibidos y gastos, conservando sus registros de origen."/><FinanceNav active="movements"/><FinanceReportFilters filters={filters} clients={clients} projects={projects} members={context.members} categories={categories} showReport={false}/><FinanceReportTable rows={result.items} total={result.total} page={result.page} pageSize={result.pageSize} filters={filters} canExport={hasPermission(admin,"reports:export")}/></div></AdminChrome>}
