import {notFound,redirect} from "next/navigation";
import {AdminChrome} from "@/components/admin/admin-chrome";
import {AdminLogin} from "@/components/admin/admin-login";
import {ModuleDetail} from "@/components/admin/module-detail";
import {getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv} from "@/lib/admin/auth";
import {hasPermission} from "@/lib/admin/authorization";
import {getCrmAuthProvider} from "@/lib/auth/provider";
import {getAddOn} from "@/lib/add-ons/data";
import {commercialPageContext} from "@/lib/commercial/page-context";
import {inspectRecordLifecycle} from "@/lib/lifecycle/data";
import {LifecycleActions} from "@/components/admin/lifecycle-actions";
export const dynamic="force-dynamic";
export default async function ModulePage({params}:{params:Promise<{id:string}>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"modules:view"))redirect("/admin");const{id}=await params;const[addOn,context,lifecycle]=await Promise.all([getAddOn(id),commercialPageContext(admin),hasPermission(admin,"records:archive")?inspectRecordLifecycle("module",id):Promise.resolve(null)]);if(!addOn)notFound();return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-3">{lifecycle?<div className="flex justify-end"><LifecycleActions entity="module" id={id} name={addOn.name} info={lifecycle} returnTo="/admin/modulos"/></div>:null}<ModuleDetail addOn={addOn} canDraft={hasPermission(admin,"modules:draft")||hasPermission(admin,"modules:manage")} canManage={hasPermission(admin,"modules:manage")} canApprove={hasPermission(admin,"module_proposals:approve")} canCorrectBilling={hasPermission(admin,"billing:correct_future")}/></div></AdminChrome>}
