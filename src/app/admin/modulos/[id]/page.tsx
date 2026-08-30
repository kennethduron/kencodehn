import {notFound,redirect} from "next/navigation";
import {AdminChrome} from "@/components/admin/admin-chrome";
import {AdminLogin} from "@/components/admin/admin-login";
import {ModuleDetail} from "@/components/admin/module-detail";
import {getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv} from "@/lib/admin/auth";
import {hasPermission} from "@/lib/admin/authorization";
import {getCrmAuthProvider} from "@/lib/auth/provider";
import {getAddOn} from "@/lib/add-ons/data";
import {commercialPageContext} from "@/lib/commercial/page-context";
export const dynamic="force-dynamic";
export default async function ModulePage({params}:{params:Promise<{id:string}>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"modules:view"))redirect("/admin");const{id}=await params;const[addOn,context]=await Promise.all([getAddOn(id),commercialPageContext(admin)]);if(!addOn)notFound();return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><ModuleDetail addOn={addOn} canDraft={hasPermission(admin,"modules:draft")||hasPermission(admin,"modules:manage")} canManage={hasPermission(admin,"modules:manage")} canApprove={hasPermission(admin,"module_proposals:approve")}/></AdminChrome>}
