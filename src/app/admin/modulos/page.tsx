import {redirect} from "next/navigation";
import {AdminChrome} from "@/components/admin/admin-chrome";
import {AdminLogin} from "@/components/admin/admin-login";
import {ModuleList} from "@/components/admin/module-list";
import {getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv} from "@/lib/admin/auth";
import {hasPermission} from "@/lib/admin/authorization";
import {getCrmAuthProvider} from "@/lib/auth/provider";
import {listAddOns} from "@/lib/add-ons/data";
import {listCommercialClients,listCommercialProjects} from "@/lib/commercial/data";
import {commercialPageContext} from "@/lib/commercial/page-context";
export const dynamic="force-dynamic";
export default async function ModulesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"modules:view"))redirect("/admin");const params=await searchParams;const value=(key:string)=>typeof params[key]==="string"?params[key] as string:undefined;const[result,clients,projects,context]=await Promise.all([listAddOns({page:Number(value("page")||1),query:value("q"),commercialStatus:value("commercialStatus")}),listCommercialClients(),listCommercialProjects(),commercialPageContext(admin)]);return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><ModuleList items={result.items} clients={clients} projects={projects} canCreate={hasPermission(admin,"modules:draft")||hasPermission(admin,"modules:manage")}/></AdminChrome>}
