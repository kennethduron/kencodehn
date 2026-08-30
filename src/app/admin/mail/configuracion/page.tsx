import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { MailIdentityManager } from "@/components/admin/mail-identity-manager";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export const dynamic = "force-dynamic";
export default async function MailConfigurationPage() { const admin = await getCurrentAdmin(); if (!admin) redirect("/admin"); if (!hasPermission(admin, "mail:manage_identities")) redirect("/admin/mail"); return <AdminChrome admin={admin} authProvider={getCrmAuthProvider()}><div className="grid gap-5"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-700">Ken Code Mail</p><h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">Identidades corporativas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-kc-muted">Las direcciones pertenecen a Ken Code. Pueden reasignarse sin alterar el historial de mensajes.</p></div><MailIdentityManager /></div></AdminChrome>; }
