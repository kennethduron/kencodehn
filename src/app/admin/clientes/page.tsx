import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ClientList } from "@/components/admin/client-list";
import { canAssignCommercialOwner, hasPermission } from "@/lib/admin/authorization";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listCommercialClients } from "@/lib/commercial/data";
import { commercialPageContext } from "@/lib/commercial/page-context";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  if (!hasPermission(admin, "clients:view")) redirect("/admin");
  const [clients, context] = await Promise.all([listCommercialClients(), commercialPageContext(admin)]);
  return <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}><div className="grid gap-6"><div><p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Clientes</p><h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Relaciones comerciales</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-kc-muted">Clientes independientes de los leads, con fecha efectiva histórica y propiedad comercial.</p></div><ClientList initialClients={clients} members={context.members} canEdit={hasPermission(admin,"clients:edit")} canAssign={canAssignCommercialOwner(admin)} /></div></AdminChrome>;
}
