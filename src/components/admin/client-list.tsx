"use client";

import { BriefcaseBusiness, ChevronLeft, ChevronRight, Plus, Search, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminMember } from "@/lib/admin/types";
import type { CommercialClient } from "@/lib/commercial/types";

const PAGE_SIZE = 10;

async function commercial(operation: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, payload }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo completar la operación.");
  return body.result as Record<string, unknown>;
}

function memberLabel(members: AdminMember[], id: string | null) {
  if (!id) return "Sin responsable";
  const member = members.find((item) => item.uid === id);
  return member?.name || member?.email || "Responsable asignado";
}

export function ClientList({ initialClients, members, canEdit, canAssign }: { initialClients: CommercialClient[]; members: AdminMember[]; canEdit: boolean; canAssign: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [seller, setSeller] = useState("all");
  const [sort, setSort] = useState("since_desc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = initialClients.filter((client) => {
      const haystack = `${client.name} ${client.company} ${client.email} ${client.phone}`.toLowerCase();
      return (!needle || haystack.includes(needle)) && (status === "all" || client.status === status) && (seller === "all" || (seller === "none" ? !client.assignedToUid : client.assignedToUid === seller));
    });
    return result.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "created_desc" ? b.createdAt.localeCompare(a.createdAt) : b.clientSince.localeCompare(a.clientSince));
  }, [initialClients, search, status, seller, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);

  async function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setFeedback("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await commercial("client_create", {
        name: String(data.get("name") || ""), company: String(data.get("company") || ""), email: String(data.get("email") || ""), phone: String(data.get("phone") || ""),
        clientSince: String(data.get("clientSince") || ""), status: String(data.get("status") || "active"), notes: String(data.get("notes") || ""),
        assignedToUid: canAssign ? String(data.get("assignedToUid") || "") : undefined,
      });
      setFormOpen(false);
      router.push(`/admin/clientes/${result.id}`);
      router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "No se pudo crear el cliente."); }
    finally { setSaving(false); }
  }

  return <div className="grid gap-5">
    <section className="kc-admin-card p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))_auto]">
        <label className="relative min-w-0">
          <span className="sr-only">Buscar clientes</span><Search className="pointer-events-none absolute left-3 top-3.5 text-kc-muted" size={17} />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar nombre, empresa, correo o teléfono" className="min-h-11 w-full rounded-xl border px-10 text-sm" />
        </label>
        <select aria-label="Filtrar por estado" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border px-3 text-sm"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
        <select aria-label="Filtrar por responsable" value={seller} onChange={(event) => { setSeller(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border px-3 text-sm"><option value="all">Todos los responsables</option><option value="none">Sin responsable</option>{members.map((member) => <option key={member.uid} value={member.uid}>{member.name || member.email}</option>)}</select>
        <select aria-label="Ordenar clientes" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-11 rounded-xl border px-3 text-sm"><option value="since_desc">Antigüedad reciente</option><option value="created_desc">Creación reciente</option><option value="name">Nombre A–Z</option></select>
        {canEdit ? <button type="button" onClick={() => setFormOpen((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white"><Plus size={17} /> Nuevo cliente</button> : null}
      </div>
    </section>

    {formOpen ? <section className="kc-admin-card p-5" aria-labelledby="new-client-title">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-kc-cyan">Alta manual</p><h2 id="new-client-title" className="mt-1 font-display text-2xl font-black text-kc-text">Nuevo cliente</h2><p className="mt-1 text-sm text-kc-muted">La fecha efectiva puede ser histórica; la fecha de creación se registra automáticamente.</p></div><button type="button" onClick={() => setFormOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border" aria-label="Cerrar formulario"><X size={18} /></button></div>
      <form onSubmit={createClient} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Nombre<input name="name" minLength={2} maxLength={160} required className="min-h-11 rounded-xl border px-3 text-kc-text" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Empresa<input name="company" maxLength={200} className="min-h-11 rounded-xl border px-3 text-kc-text" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Cliente desde<input name="clientSince" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} required className="min-h-11 rounded-xl border px-3 text-kc-text" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Correo<input name="email" type="email" autoComplete="email" className="min-h-11 rounded-xl border px-3 text-kc-text" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Teléfono<input name="phone" autoComplete="tel" maxLength={60} className="min-h-11 rounded-xl border px-3 text-kc-text" /></label>
        <label className="grid gap-2 text-sm font-bold text-kc-muted">Estado<select name="status" defaultValue="active" className="min-h-11 rounded-xl border px-3 text-kc-text"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
        {canAssign ? <label className="grid gap-2 text-sm font-bold text-kc-muted">Responsable<select name="assignedToUid" className="min-h-11 rounded-xl border px-3 text-kc-text"><option value="">Sin responsable</option>{members.map((member) => <option key={member.uid} value={member.uid}>{member.name || member.email}</option>)}</select></label> : null}
        <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2 xl:col-span-3">Notas<textarea name="notes" rows={3} maxLength={5000} className="rounded-xl border p-3 text-kc-text" /></label>
        {feedback ? <p role="alert" className="text-sm font-bold text-rose-700 sm:col-span-2 xl:col-span-3">{feedback}</p> : null}
        <button disabled={saving} className="min-h-11 rounded-xl bg-kc-electric px-5 text-sm font-black text-white disabled:opacity-60 sm:col-span-2 xl:col-span-1">{saving ? "Guardando…" : "Crear cliente"}</button>
      </form>
    </section> : null}

    {visible.length === 0 ? <section className="kc-admin-card grid min-h-64 place-items-center p-8 text-center"><div><BriefcaseBusiness className="mx-auto text-kc-cyan" size={34} /><h2 className="mt-4 font-display text-2xl font-black text-kc-text">Sin clientes en esta vista</h2><p className="mt-2 max-w-md text-sm leading-6 text-kc-muted">Cree un cliente manualmente o convierta un lead ganado. No se insertan datos ficticios.</p></div></section> : <>
      <div className="grid gap-3 md:hidden">{visible.map((client) => <Link key={client.id} href={`/admin/clientes/${client.id}`} className="kc-admin-card block p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-black text-kc-text">{client.name}</h2><p className="truncate text-sm text-kc-muted">{client.company || client.email || "Sin empresa"}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${client.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{client.status === "active" ? "Activo" : "Inactivo"}</span></div><dl className="mt-4 grid gap-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-kc-muted">Cliente desde</dt><dd className="font-bold text-kc-text">{client.clientSince}</dd></div><div className="flex justify-between gap-4"><dt className="text-kc-muted">Responsable</dt><dd className="truncate font-bold text-kc-text">{memberLabel(members, client.assignedToUid)}</dd></div></dl></Link>)}</div>
      <div className="kc-admin-card hidden overflow-hidden md:block"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b"><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Contacto</th><th className="px-5 py-4">Desde</th><th className="px-5 py-4">Responsable</th><th className="px-5 py-4">Estado</th></tr></thead><tbody>{visible.map((client) => <tr key={client.id} className="border-b last:border-0"><td className="px-5 py-4"><Link href={`/admin/clientes/${client.id}`} className="font-black text-kc-electric hover:underline">{client.name}</Link><p className="text-xs text-kc-muted">{client.company || "Sin empresa"}</p></td><td className="px-5 py-4"><p>{client.email || "Sin correo"}</p><p className="text-xs text-kc-muted">{client.phone || "Sin teléfono"}</p></td><td className="px-5 py-4 font-bold">{client.clientSince}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-2"><UserRoundCheck size={16} className="text-kc-muted" />{memberLabel(members, client.assignedToUid)}</span></td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${client.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{client.status === "active" ? "Activo" : "Inactivo"}</span></td></tr>)}</tbody></table></div></div>
    </>}

    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-kc-muted"><p>{filtered.length} cliente{filtered.length === 1 ? "" : "s"}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid h-11 w-11 place-items-center rounded-xl border disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={18} /></button><span className="min-w-20 text-center font-bold text-kc-text">{Math.min(page, pages)} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="grid h-11 w-11 place-items-center rounded-xl border disabled:opacity-40" aria-label="Página siguiente"><ChevronRight size={18} /></button></div></div>
  </div>;
}
