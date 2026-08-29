import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ProjectList } from "@/components/admin/project-list";
import { canAssignCommercialOwner, hasPermission } from "@/lib/admin/authorization";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listCommercialClients, listCommercialProjects } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  if (!hasPermission(admin,"projects:view")) redirect("/admin");
  const [projects, clients, context] = await Promise.all([listCommercialProjects(), listCommercialClients(), commercialPageContext(admin)]);
  return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-6"><div><p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Proyectos</p><h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Ejecución y acuerdos</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-kc-muted">Proyectos por cliente, importes contractuales y planificación flexible sin registrar pagos reales.</p></div><ProjectList initialProjects={projects} clients={clients} members={context.members} canEdit={hasPermission(admin,"projects:edit")} canAssign={canAssignCommercialOwner(admin)} /></div></AdminChrome>;
}
