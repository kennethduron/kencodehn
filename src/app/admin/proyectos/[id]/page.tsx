import {notFound,redirect} from "next/navigation";
import {AdminChrome} from "@/components/admin/admin-chrome";
import {AdminLogin} from "@/components/admin/admin-login";
import {ProjectDetail} from "@/components/admin/project-detail";
import {ModuleSummary} from "@/components/admin/module-summary";
import {canAssignCommercialOwner,hasPermission} from "@/lib/admin/authorization";
import {getCurrentAdmin,getMissingAdminEnv,getMissingAuthClientEnv} from "@/lib/admin/auth";
import {getCrmAuthProvider} from "@/lib/auth/provider";
import {getCommercialClient,getCommercialProject} from "@/lib/commercial/data";
import {commercialPageContext} from "@/lib/commercial/page-context";
import {getProjectBillingSummary,listReceivables} from "@/lib/billing/data";
import {listProjectAddOns} from "@/lib/add-ons/data";
import {inspectRecordLifecycle} from "@/lib/lifecycle/data";
import {LifecycleActions} from "@/components/admin/lifecycle-actions";
export const dynamic="force-dynamic";
export default async function ProjectPage({params}:{params:Promise<{id:string}>}){const admin=await getCurrentAdmin();if(!admin)return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()}/>;if(!hasPermission(admin,"projects:view"))redirect("/admin");const{id}=await params;const[detail,context,billingSummary,receivables,addOns,lifecycle]=await Promise.all([getCommercialProject(id),commercialPageContext(admin),getProjectBillingSummary(id),listReceivables({projectId:id,pageSize:50}),listProjectAddOns(id),hasPermission(admin,"records:archive")?inspectRecordLifecycle("project",id):Promise.resolve(null)]);if(!detail)notFound();const clientDetail=await getCommercialClient(detail.project.clientId);if(!clientDetail)notFound();return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-5">{lifecycle?<div className="flex justify-end"><LifecycleActions entity="project" id={id} name={detail.project.name} info={lifecycle} returnTo="/admin/proyectos"/></div>:null}<ProjectDetail {...detail} billingSummary={billingSummary} billingReceivables={receivables.items} client={clientDetail.client} members={context.members} canEdit={hasPermission(admin,"projects:edit")} canAssign={canAssignCommercialOwner(admin)} canEditPlans={hasPermission(admin,"commercial_plans:edit")} canEditRecurring={hasPermission(admin,"recurring_services:edit")}/><ModuleSummary items={addOns}/></div></AdminChrome>}
