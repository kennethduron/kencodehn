import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { SecurityPanel } from "@/components/auth/security-panel";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  if (getCrmAuthProvider() !== "supabase") redirect("/admin");
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");
  return <AdminChrome admin={admin} authProvider="supabase"><div className="grid gap-6"><div><p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Mi cuenta</p><h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Seguridad</h1></div><SecurityPanel email={admin.email} /></div></AdminChrome>;
}
