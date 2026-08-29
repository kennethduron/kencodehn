"use client";

import { ChevronLeft, ChevronRight, FolderKanban, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminMember } from "@/lib/admin/types";
import type { CommercialClient, CommercialProject } from "@/lib/commercial/types";
import { compareMinor, formatMinor, parseMoneyToMinor } from "@/lib/billing/money";

const PAGE_SIZE = 10;
const statusLabels: Record<string, string> = { draft: "Borrador", planning: "Planificación", active: "Activo", on_hold: "En pausa", completed: "Completado", cancelled: "Cancelado" };
const money = formatMinor;

async function mutate(operation: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo completar la operación.");
  return body.result;
}

export function ProjectList({ initialProjects, clients, members, canEdit, canAssign }: { initialProjects: CommercialProject[]; clients: CommercialClient[]; members: AdminMember[]; canEdit: boolean; canAssign: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [client, setClient] = useState("all"); const [seller, setSeller] = useState("all"); const [sort, setSort] = useState("created_desc"); const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false); const [saving, setSaving] = useState(false); const [feedback, setFeedback] = useState("");
  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item.company || item.name])), [clients]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return initialProjects.filter((project) => (!needle || `${project.name} ${project.description} ${project.clientName}`.toLowerCase().includes(needle)) && (status === "all" || project.status === status) && (client === "all" || project.clientId === client) && (seller === "all" || (seller === "none" ? !project.assignedToUid : project.assignedToUid === seller))).sort((a,b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "amount_desc" ? compareMinor(b.totalAmountMinor, a.totalAmountMinor) : b.createdAt.localeCompare(a.createdAt));
  }, [initialProjects, search, status, client, seller, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const visible = filtered.slice((Math.min(page,pages)-1)*PAGE_SIZE, Math.min(page,pages)*PAGE_SIZE);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFeedback(""); const data = new FormData(event.currentTarget);
    try {
      const amountMinor = parseMoneyToMinor(String(data.get("totalAmount") || "0")).toString();
      const result = await mutate("project_create", { clientId: String(data.get("clientId") || ""), name: String(data.get("name") || ""), description: String(data.get("description") || ""), status: String(data.get("status") || "planning"), totalAmountMinor: amountMinor, currency: String(data.get("currency") || "USD").toUpperCase(), soldAt: String(data.get("soldAt") || ""), effectiveDate: String(data.get("effectiveDate") || ""), startDate: String(data.get("startDate") || ""), targetEndDate: String(data.get("targetEndDate") || ""), assignedToUid: canAssign ? String(data.get("assignedToUid") || "") : undefined });
      setFormOpen(false); router.push(`/admin/proyectos/${result.id}`); router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "No se pudo crear el proyecto."); }
    finally { setSaving(false); }
  }

  return <div className="grid gap-5">
    <section className="kc-admin-card p-4 sm:p-5"><div className="grid gap-3 xl:grid-cols-[minmax(14rem,1fr)_repeat(4,minmax(8.5rem,auto))_auto]">
      <label className="relative"><span className="sr-only">Buscar proyectos</span><Search className="pointer-events-none absolute left-3 top-3.5 text-kc-muted" size={17} /><input value={search} onChange={(event)=>{setSearch(event.target.value);setPage(1);}} placeholder="Buscar proyecto o cliente" className="min-h-11 w-full rounded-xl border px-10 text-sm" /></label>
      <select aria-label="Filtrar por estado" value={status} onChange={(event)=>{setStatus(event.target.value);setPage(1);}} className="min-h-11 rounded-xl border px-3 text-sm"><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Filtrar por cliente" value={client} onChange={(event)=>{setClient(event.target.value);setPage(1);}} className="min-h-11 rounded-xl border px-3 text-sm"><option value="all">Todos los clientes</option>{clients.map((item)=><option key={item.id} value={item.id}>{item.company || item.name}</option>)}</select>
      <select aria-label="Filtrar por responsable" value={seller} onChange={(event)=>{setSeller(event.target.value);setPage(1);}} className="min-h-11 rounded-xl border px-3 text-sm"><option value="all">Todos los responsables</option><option value="none">Sin responsable</option>{members.map((member)=><option key={member.uid} value={member.uid}>{member.name || member.email}</option>)}</select>
      <select aria-label="Ordenar proyectos" value={sort} onChange={(event)=>setSort(event.target.value)} className="min-h-11 rounded-xl border px-3 text-sm"><option value="created_desc">Creación reciente</option><option value="amount_desc">Mayor monto</option><option value="name">Nombre A–Z</option></select>
      {canEdit?<button type="button" onClick={()=>setFormOpen((value)=>!value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white"><Plus size={17}/> Nuevo proyecto</button>:null}
    </div></section>

    {formOpen?<section className="kc-admin-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-kc-cyan">Proyecto</p><h2 className="mt-1 font-display text-2xl font-black text-kc-text">Nuevo proyecto</h2><p className="mt-1 text-sm text-kc-muted">El monto usa unidades menores en base de datos; no crea cuentas por cobrar.</p></div><button type="button" onClick={()=>setFormOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border" aria-label="Cerrar formulario"><X size={18}/></button></div>
      {clients.length===0?<p className="mt-5 rounded-xl border border-dashed p-5 text-sm text-kc-muted">Primero cree un cliente.</p>:<form onSubmit={createProject} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Cliente<select name="clientId" required className="min-h-11 rounded-xl border px-3"><option value="">Seleccione…</option>{clients.map((item)=><option key={item.id} value={item.id}>{item.company || item.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Nombre<input name="name" required minLength={2} maxLength={180} className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Estado<select name="status" defaultValue="planning" className="min-h-11 rounded-xl border px-3">{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Monto total<input name="totalAmount" type="number" min="0" step="0.01" defaultValue="0.00" required inputMode="decimal" className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Moneda<input name="currency" pattern="[A-Z]{3}" maxLength={3} defaultValue="USD" required className="min-h-11 rounded-xl border px-3 uppercase" /></label>
        {canAssign?<label className="grid gap-2 text-sm font-bold text-kc-muted">Responsable<select name="assignedToUid" className="min-h-11 rounded-xl border px-3"><option value="">Heredar del cliente</option>{members.map((member)=><option key={member.uid} value={member.uid}>{member.name || member.email}</option>)}</select></label>:null}
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Fecha efectiva<input name="effectiveDate" type="date" max={new Date().toISOString().slice(0,10)} defaultValue={new Date().toISOString().slice(0,10)} required className="min-h-11 rounded-xl border px-3" /></label><label className="grid gap-2 text-sm font-bold text-kc-muted">Fecha de venta<input name="soldAt" type="date" className="min-h-11 rounded-xl border px-3" /></label><label className="grid gap-2 text-sm font-bold text-kc-muted">Inicio<input name="startDate" type="date" className="min-h-11 rounded-xl border px-3" /></label><label className="grid gap-2 text-sm font-bold text-kc-muted">Fecha objetivo<input name="targetEndDate" type="date" className="min-h-11 rounded-xl border px-3" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2 xl:col-span-3">Descripción<textarea name="description" rows={3} maxLength={8000} className="rounded-xl border p-3" /></label>
        {feedback?<p role="alert" className="text-sm font-bold text-rose-700 sm:col-span-2 xl:col-span-3">{feedback}</p>:null}<button disabled={saving} className="min-h-11 rounded-xl bg-kc-electric px-5 text-sm font-black text-white disabled:opacity-60">{saving?"Guardando…":"Crear proyecto"}</button>
      </form>}
    </section>:null}

    {visible.length===0?<section className="kc-admin-card grid min-h-64 place-items-center p-8 text-center"><div><FolderKanban className="mx-auto text-kc-cyan" size={34}/><h2 className="mt-4 font-display text-2xl font-black text-kc-text">Sin proyectos en esta vista</h2><p className="mt-2 text-sm text-kc-muted">No se crean proyectos de ejemplo en Production.</p></div></section>:<>
      <div className="grid gap-3 md:hidden">{visible.map((project)=><Link key={project.id} href={`/admin/proyectos/${project.id}`} className="kc-admin-card block p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-black text-kc-text">{project.name}</h2><p className="truncate text-sm text-kc-muted">{project.clientName || clientMap.get(project.clientId)}</p></div><span className="rounded-full border bg-blue-50 px-2.5 py-1 text-xs font-black text-kc-electric">{statusLabels[project.status]}</span></div><p className="mt-4 font-display text-2xl font-black text-kc-text">{money(project.totalAmountMinor,project.currency)}</p></Link>)}</div>
      <div className="kc-admin-card hidden overflow-hidden md:block"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b"><th className="px-5 py-4">Proyecto</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Monto</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Inicio</th></tr></thead><tbody>{visible.map((project)=><tr key={project.id} className="border-b last:border-0"><td className="px-5 py-4"><Link href={`/admin/proyectos/${project.id}`} className="font-black text-kc-electric hover:underline">{project.name}</Link></td><td className="px-5 py-4">{project.clientName || clientMap.get(project.clientId)}</td><td className="px-5 py-4 font-black">{money(project.totalAmountMinor,project.currency)}</td><td className="px-5 py-4"><span className="rounded-full border bg-blue-50 px-2.5 py-1 text-xs font-black text-kc-electric">{statusLabels[project.status]}</span></td><td className="px-5 py-4">{project.startDate || "Sin fecha"}</td></tr>)}</tbody></table></div></div>
    </>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-kc-muted"><p>{filtered.length} proyecto{filtered.length===1?"":"s"}</p><div className="flex items-center gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage((value)=>Math.max(1,value-1))} className="grid h-11 w-11 place-items-center rounded-xl border disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={18}/></button><span className="min-w-20 text-center font-bold text-kc-text">{Math.min(page,pages)} / {pages}</span><button type="button" disabled={page>=pages} onClick={()=>setPage((value)=>Math.min(pages,value+1))} className="grid h-11 w-11 place-items-center rounded-xl border disabled:opacity-40" aria-label="Página siguiente"><ChevronRight size={18}/></button></div></div>
  </div>;
}
