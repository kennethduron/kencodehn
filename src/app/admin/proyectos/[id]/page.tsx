import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ProjectDetail } from "@/components/admin/project-detail";
import { canAssignCommercialOwner, hasPermission } from "@/lib/admin/authorization";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { getCommercialClient, getCommercialProject } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  if (!hasPermission(admin,"projects:view")) redirect("/admin");
  const { id } = await params;
  const [detail, context] = await Promise.all([getCommercialProject(id), commercialPageContext(admin)]);
  if (!detail) notFound();
  const clientDetail = await getCommercialClient(detail.project.clientId);
  if (!clientDetail) notFound();
  return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><ProjectDetail {...detail} client={clientDetail.client} members={context.members} canEdit={hasPermission(admin,"projects:edit")} canAssign={canAssignCommercialOwner(admin)} canEditPlans={hasPermission(admin,"commercial_plans:edit")} canEditRecurring={hasPermission(admin,"recurring_services:edit")} /></AdminChrome>;
}
