import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { BillingPanel } from "@/components/admin/billing-panel";
import { hasPermission } from "@/lib/admin/authorization";
import { getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { billingSummary,listReceivables } from "@/lib/billing/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
export const dynamic="force-dynamic";
export default async function BillingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"billing:view"))redirect("/admin");const p=await searchParams;const value=(key:string)=>typeof p[key]==="string"?p[key] as string:undefined;const[receivables,summary,context]=await Promise.all([listReceivables({page:Number(value("page")||1),state:value("state"),timing:value("timing"),origin:value("origin"),currency:"USD"}),billingSummary(),commercialPageContext(admin)]);return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-6"><div><p className="text-sm font-black uppercase tracking-[.2em] text-kc-cyan">Cobros</p><h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">Cuentas por cobrar</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-kc-muted">Obligaciones reales en USD, pagos aplicados y saldos pendientes. Los acuerdos y mensualidades permanecen separados.</p></div><BillingPanel {...receivables} summary={summary as any} canManage={hasPermission(admin,"payments:manage")}/></div></AdminChrome>}
