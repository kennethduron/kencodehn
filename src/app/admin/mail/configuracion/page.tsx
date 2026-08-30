import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { MailIdentityManager } from "@/components/admin/mail-identity-manager";
import { MailSettingsManager } from "@/components/admin/mail-settings-manager";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export const dynamic = "force-dynamic";
export default async function MailConfigurationPage() { const admin = await getCurrentAdmin(); if (!admin) redirect("/admin"); if (!hasPermission(admin, "mail:use")) redirect("/admin/mail"); const canManageIdentities = hasPermission(admin, "mail:manage_identities"); return <AdminChrome admin={admin} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-700">Ken Code Mail</p><h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">Configuración de Mail</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-kc-muted">Administre firmas y plantillas; las direcciones corporativas continúan bajo control exclusivo del Owner.</p></div>{canManageIdentities ? <MailIdentityManager /> : null}<MailSettingsManager /></div></AdminChrome>; }
