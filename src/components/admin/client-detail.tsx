"use client";

import { Activity, ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, ClipboardList, CreditCard, FolderKanban, Mail, ReceiptText, Save, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminMember } from "@/lib/admin/types";
import type { CommercialActivity, CommercialClient, CommercialProject, SellerAssignmentEvent } from "@/lib/commercial/types";
import type { BillingPayment, BillingReceivable } from "@/lib/billing/types";
import { ClientBillingSection, ClientBillingSettings, ClientPaymentsSection } from "./billing-detail-sections";
import { formatMinor } from "@/lib/billing/money";

const tabs = [
  ["overview", "Resumen"], ["projects", "Proyectos"], ["billing", "Facturación"], ["payments", "Pagos"], ["tasks", "Tareas"], ["communications", "Comunicaciones"], ["activity", "Actividad"],
] as const;

async function mutate(operation: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo completar la operación.");
  return body.result;
}

function EmptyFuture({ icon: Icon, title, children }: { icon: typeof CreditCard; title: string; children: React.ReactNode }) {
  return <div className="kc-admin-card grid min-h-64 place-items-center p-8 text-center"><div><Icon className="mx-auto text-kc-cyan" size={32} /><h2 className="mt-4 font-display text-2xl font-black text-kc-text">{title}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-kc-muted">{children}</p></div></div>;
}

export function ClientDetail({ client, projects, tasks, activity, assignments, billingReceivables, billingPayments, members, canEdit, canAssign, canManageBilling }: {
  client: CommercialClient; projects: CommercialProject[]; tasks: Record<string, any>[]; activity: CommercialActivity[]; assignments: SellerAssignmentEvent[]; billingReceivables: BillingReceivable[]; billingPayments: BillingPayment[]; members: AdminMember[]; canEdit: boolean; canAssign: boolean; canManageBilling: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("overview");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback("");
    const data = new FormData(event.currentTarget);
    try {
      await mutate("client_update", { id: client.id, updates: { name: String(data.get("name") || ""), company: String(data.get("company") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""), clientSince: String(data.get("clientSince") || ""), status: String(data.get("status") || "active"), notes: String(data.get("notes") || "") } });
      setFeedback("Cliente actualizado."); router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "No se pudo actualizar."); }
    finally { setSaving(false); }
  }

  async function assign(value: string) {
    setSaving(true); setFeedback("");
    try { await mutate("client_assign", { id: client.id, assignedToUid: value, reason: "Actualización desde la ficha del cliente" }); setFeedback("Responsable actualizado."); router.refresh(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "No se pudo reasignar."); }
    finally { setSaving(false); }
  }

  return <div className="grid gap-5">
    <div><Link href="/admin/clientes" className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-kc-electric"><ArrowLeft size={17} /> Volver a clientes</Link><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-kc-cyan">Cliente</p><h1 className="mt-1 font-display text-3xl font-black text-kc-text sm:text-4xl">{client.name}</h1><p className="mt-2 text-kc-muted">{client.company || "Cliente particular"} · relación efectiva desde {client.clientSince}</p></div><span className={`w-fit rounded-full border px-3 py-1.5 text-sm font-black ${client.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{client.status === "active" ? "Activo" : "Inactivo"}</span></div></div>
    <div className="overflow-x-auto pb-1"><div className="inline-flex min-w-max gap-2 rounded-2xl border bg-white p-2" role="tablist" aria-label="Secciones del cliente">{tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`min-h-11 rounded-xl px-4 text-sm font-black ${tab === value ? "bg-kc-electric text-white" : "text-kc-muted hover:bg-slate-50"}`}>{label}</button>)}</div></div>

    {tab === "overview" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <form onSubmit={update} className="kc-admin-card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-display text-2xl font-black text-kc-text sm:col-span-2">Información comercial</h2>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Nombre<input name="name" defaultValue={client.name} disabled={!canEdit} minLength={2} required className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Empresa<input name="company" defaultValue={client.company} disabled={!canEdit} className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Correo<input name="email" type="email" defaultValue={client.email} disabled={!canEdit} className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Teléfono<input name="phone" defaultValue={client.phone} disabled={!canEdit} className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Cliente desde<input name="clientSince" type="date" max={new Date().toISOString().slice(0,10)} defaultValue={client.clientSince} disabled={!canEdit} className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Estado<select name="status" defaultValue={client.status} disabled={!canEdit} className="min-h-11 rounded-xl border px-3"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2">Notas<textarea name="notes" defaultValue={client.notes} disabled={!canEdit} rows={5} className="rounded-xl border p-3" /></label>
        {feedback ? <p role="status" className="text-sm font-bold text-kc-electric sm:col-span-2">{feedback}</p> : null}
        {canEdit ? <button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2"><Save size={17} /> {saving ? "Guardando…" : "Guardar cambios"}</button> : null}
      </form>
      <aside className="grid content-start gap-4">
        <div className="kc-admin-card p-5"><h2 className="flex items-center gap-2 font-display text-xl font-black text-kc-text"><UserRoundCheck size={19} /> Responsable</h2>{canAssign ? <select aria-label="Responsable comercial" defaultValue={client.assignedToUid || ""} disabled={saving} onChange={(event) => assign(event.target.value)} className="mt-4 min-h-11 w-full rounded-xl border px-3"><option value="">Sin responsable</option>{members.map((member) => <option key={member.uid} value={member.uid}>{member.name || member.email}</option>)}</select> : <p className="mt-3 text-sm text-kc-muted">{members.find((member) => member.uid === client.assignedToUid)?.name || members.find((member) => member.uid === client.assignedToUid)?.email || "Sin responsable"}</p>}</div>
        <div className="kc-admin-card p-5"><h2 className="font-display text-xl font-black text-kc-text">Trazabilidad</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-kc-muted">Creado en sistema</dt><dd className="font-bold text-kc-text">{new Date(client.createdAt).toLocaleString("es-HN")}</dd></div><div><dt className="text-kc-muted">Origen</dt><dd className="font-bold text-kc-text">{client.originLeadId ? <Link href={`/admin/leads/${client.originLeadId}`} className="text-kc-electric hover:underline">Lead convertido</Link> : "Alta manual"}</dd></div><div><dt className="text-kc-muted">Reasignaciones</dt><dd className="font-bold text-kc-text">{assignments.length}</dd></div></dl></div>
      </aside>
    </div> : null}

    {tab === "projects" ? projects.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Link key={project.id} href={`/admin/proyectos/${project.id}`} className="kc-admin-card p-5"><FolderKanban className="text-kc-cyan" size={24} /><h2 className="mt-4 font-display text-xl font-black text-kc-text">{project.name}</h2><p className="mt-2 text-sm text-kc-muted">{project.status} · {formatMinor(project.totalAmountMinor, project.currency)}</p></Link>)}</div> : <EmptyFuture icon={FolderKanban} title="Sin proyectos">Cree el primer proyecto desde el módulo Proyectos y asócielo a este cliente.</EmptyFuture> : null}
    {tab === "billing" ? <div className="grid gap-5"><ClientBillingSettings client={client} canManage={canManageBilling}/><ClientBillingSection receivables={billingReceivables} /></div> : null}
    {tab === "payments" ? <ClientPaymentsSection payments={billingPayments} /> : null}
    {tab === "tasks" ? tasks.length ? <div className="grid gap-3">{tasks.map((task) => <article key={task.id} className="kc-admin-card p-4"><div className="flex flex-wrap items-center gap-2"><ClipboardList size={18} className="text-kc-cyan" /><h2 className="font-black text-kc-text">{task.title}</h2><span className="rounded-full border px-2 py-1 text-xs font-bold text-kc-muted">{task.status}</span></div><p className="mt-2 text-sm text-kc-muted">{task.due_at ? new Date(task.due_at).toLocaleString("es-HN") : "Sin fecha"}</p></article>)}</div> : <EmptyFuture icon={CalendarDays} title="Sin tareas del cliente">Las tareas comerciales asociadas al cliente aparecerán aquí.</EmptyFuture> : null}
    {tab === "communications" ? <EmptyFuture icon={Mail} title="Sin comunicaciones">La bandeja de comunicaciones se conectará en una etapa futura; Ken Code Mail no fue iniciado.</EmptyFuture> : null}
    {tab === "activity" ? activity.length ? <div className="grid gap-3">{activity.map((event) => <article key={event.id} className="kc-admin-card grid grid-cols-[auto_1fr] gap-4 p-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-kc-electric"><CheckCircle2 size={18} /></span><div><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><h2 className="font-black text-kc-text">{event.title}</h2><time className="text-xs font-bold text-kc-muted">{new Date(event.createdAt).toLocaleString("es-HN")}</time></div><p className="mt-1 text-sm text-kc-muted">{event.description}</p><p className="mt-2 text-xs font-bold text-kc-muted">Actor: {event.actorEmail}</p></div></article>)}</div> : <EmptyFuture icon={Activity} title="Sin actividad">Los eventos humanos del cliente aparecerán en esta línea de tiempo.</EmptyFuture> : null}
  </div>;
}
