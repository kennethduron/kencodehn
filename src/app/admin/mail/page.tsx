import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { MailWorkspace } from "@/components/admin/mail-workspace";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { hasPermission } from "@/lib/admin/authorization";
import { listMail, loadThread, type MailFolder } from "@/lib/mail/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const folders = new Set<MailFolder>(["inbox", "sent", "drafts", "archived", "trash", "follow-up"]);
export default async function MailPage({ searchParams }: { searchParams: Promise<{ folder?: string; q?: string; cursor?: string; thread?: string; compose?: string; to?: string; lead?: string; client?: string; project?: string; addOn?: string; proposal?: string }> }) {
  const admin = await getCurrentAdmin(); if (!admin) redirect("/admin"); if (!hasPermission(admin, "mail:use")) redirect("/admin");
  const params = await searchParams; const folder = folders.has(params.folder as MailFolder) ? params.folder as MailFolder : "inbox";
  const initial = await listMail(admin, folder, (params.q || "").slice(0, 120), params.cursor); let selected = params.thread ? await loadThread(admin, params.thread).catch(() => null) : null;
  const context = { clientName: "", businessName: "", projectName: "", moduleName: "", proposalNumber: "" };
  if (params.compose === "1" || selected) { const client = await createSupabaseServerClient(); const leadId = params.lead || selected?.thread.lead_id; const clientId = params.client || selected?.thread.client_id; const projectId = params.project || selected?.thread.project_id; const addOnId = params.addOn || selected?.thread.add_on_id; const proposalId = params.proposal || selected?.thread.proposal_id; const [lead, company, project, addOn, proposal] = await Promise.all([leadId ? client.from("leads").select("name").eq("id", leadId).maybeSingle() : null, clientId ? client.from("clients").select("name,company").eq("id", clientId).maybeSingle() : null, projectId ? client.from("projects").select("name").eq("id", projectId).maybeSingle() : null, addOnId ? client.from("project_add_ons").select("name").eq("id", addOnId).maybeSingle() : null, proposalId ? client.from("add_on_proposals").select("proposal_number,title,status").eq("id", proposalId).maybeSingle() : null]); const clientData = company?.data; const leadData = lead?.data; context.clientName = clientData?.name || clientData?.company || leadData?.name || ""; context.businessName = clientData?.company || ""; context.projectName = project?.data?.name || ""; context.moduleName = addOn?.data?.name || ""; context.proposalNumber = proposal?.data?.proposal_number || ""; if (selected) selected = { ...selected, thread: { ...selected.thread, leads: leadData || undefined, clients: clientData || undefined, projects: project?.data || undefined, project_add_ons: addOn?.data || undefined, add_on_proposals: proposal?.data || undefined } }; }
  return <AdminChrome admin={admin} authProvider={getCrmAuthProvider()}><MailWorkspace admin={admin} initial={{ ...initial, selected }} composeContext={{ open: params.compose === "1", to: params.to || "", leadId: params.lead, clientId: params.client, projectId: params.project, addOnId: params.addOn, proposalId: params.proposal, ...context }} /></AdminChrome>;
}
