import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ExpensePanel } from "@/components/admin/expense-panel";
import { FinanceNav,FinancePageHeader } from "@/components/admin/finance-nav";
import { ExpenseCategoryManager } from "@/components/admin/expense-category-manager";
import { getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listCommercialProjects } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
import { listExpenseCategories,listExpenses } from "@/lib/finance/data";

export const dynamic="force-dynamic";
export default async function ExpensesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"expenses:view"))redirect("/admin");const p=await searchParams;const value=(key:string)=>typeof p[key]==="string"?p[key] as string:undefined;const[expenses,categories,projects,context]=await Promise.all([listExpenses({page:Number(value("page")||1),currency:"USD",categoryId:value("category"),status:value("status")}),listExpenseCategories(),listCommercialProjects(),commercialPageContext(admin)]);const canCreate=hasPermission(admin,"expenses:create");return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><FinancePageHeader title="Gastos" description="Salidas de caja en USD con categoria, proyecto opcional, actor y anulacion auditable."/><FinanceNav active="expenses"/>{canCreate?<ExpenseCategoryManager categories={categories}/>:null}<ExpensePanel {...expenses} categories={categories} projects={projects} canCreate={canCreate} canReverse={hasPermission(admin,"expenses:reverse")}/></div></AdminChrome>}
