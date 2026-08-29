import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ClientDetail } from "@/components/admin/client-detail";
import { canAssignCommercialOwner, hasPermission } from "@/lib/admin/authorization";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { getCommercialClient } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  if (!hasPermission(admin,"clients:view")) redirect("/admin");
  const { id } = await params;
  const [detail, context] = await Promise.all([getCommercialClient(id), commercialPageContext(admin)]);
  if (!detail) notFound();
  return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><ClientDetail {...detail} members={context.members} canEdit={hasPermission(admin,"clients:edit")} canAssign={canAssignCommercialOwner(admin)} /></AdminChrome>;
}
