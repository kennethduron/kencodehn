import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { ProfilePanel } from "@/components/admin/profile-panel";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const admin = await getCurrentAdmin(); if (!admin) redirect("/admin");
  return <AdminChrome admin={admin} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">Mi cuenta</p><h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">Mi perfil</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-kc-muted">Actualiza cómo te identificas dentro del CRM y de las conversaciones de Ken Code.</p></div><ProfilePanel admin={admin} /></div></AdminChrome>;
}
