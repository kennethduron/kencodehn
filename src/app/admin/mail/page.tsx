import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { MailWorkspace } from "@/components/admin/mail-workspace";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { hasPermission } from "@/lib/admin/authorization";
import { listMail, loadThread, type MailFolder } from "@/lib/mail/service";

export const dynamic = "force-dynamic";
const folders = new Set<MailFolder>(["inbox", "sent", "drafts", "archived", "trash", "follow-up"]);
export default async function MailPage({ searchParams }: { searchParams: Promise<{ folder?: string; q?: string; thread?: string; compose?: string; to?: string; lead?: string; client?: string; project?: string; addOn?: string; proposal?: string }> }) {
  const admin = await getCurrentAdmin(); if (!admin) redirect("/admin"); if (!hasPermission(admin, "mail:use")) redirect("/admin");
  const params = await searchParams; const folder = folders.has(params.folder as MailFolder) ? params.folder as MailFolder : "inbox";
  const initial = await listMail(admin, folder, (params.q || "").slice(0, 120)); const selected = params.thread ? await loadThread(admin, params.thread).catch(() => null) : null;
  return <AdminChrome admin={admin} authProvider={getCrmAuthProvider()}><MailWorkspace admin={admin} initial={{ ...initial, selected }} composeContext={{ open: params.compose === "1", to: params.to || "", leadId: params.lead, clientId: params.client, projectId: params.project, addOnId: params.addOn, proposalId: params.proposal }} /></AdminChrome>;
}
