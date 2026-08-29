import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { PaymentList } from "@/components/admin/payment-list";
import { getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listPaymentsPage } from "@/lib/billing/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
export const dynamic="force-dynamic";
export default async function PaymentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"billing:view"))redirect("/admin");const p=await searchParams;const value=(key:string)=>typeof p[key]==="string"?p[key] as string:undefined;const[result,context]=await Promise.all([listPaymentsPage({page:Number(value("page")||1),currency:value("currency"),status:value("status")}),commercialPageContext(admin)]);return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><div className="kc-page-header"><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Pagos</p><h1 className="mt-1 font-display text-2xl font-black sm:text-3xl">Pagos recibidos</h1><p className="mt-1 text-sm text-kc-muted">Dinero real recibido, sus aplicaciones y reversiones con historial preservado.</p></div><PaymentList {...result}/></div></AdminChrome>}
