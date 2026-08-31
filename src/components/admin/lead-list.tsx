"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, Copy, ExternalLink, Mail, Search, SlidersHorizontal } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import type { AdminLead, AssignableSalesAgent, LeadPriority, LeadStatus } from "@/lib/admin/types";
import { whatsappLink } from "@/lib/site";
import { leadPriorityLabels, leadSourcePageLabel, leadStatusLabels, money, shortDate } from "./admin-labels";
import { LeadPriorityBadge, LeadStatusBadge } from "./status-badge";
import { Toast, Tooltip } from "./ui";

const statuses = Object.entries(leadStatusLabels) as [LeadStatus, string][];
const priorities = Object.entries(leadPriorityLabels) as [LeadPriority, string][];
const priorityRank: Record<LeadPriority, number> = { high: 3, medium: 2, low: 1 };

type SortKey = "recent" | "oldest" | "high_priority" | "estimated_value" | "next_followup";

function uniqueValues(leads: AdminLead[], key: keyof Pick<AdminLead, "project" | "locale" | "source" | "sourcePath">) {
  return Array.from(new Set(leads.map((lead) => String(lead[key] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function LeadList({ initialLeads, canEdit, canCreateTasks, canAssign = false, assignableUsers = [] }: { initialLeads: AdminLead[]; canEdit: boolean; canCreateTasks: boolean; canAssign?: boolean; assignableUsers?: AssignableSalesAgent[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [project, setProject] = useState("all");
  const [locale, setLocale] = useState("all");
  const [source, setSource] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");

  const projects = useMemo(() => uniqueValues(leads, "project"), [leads]);
  const sources = useMemo(() => uniqueValues(leads, "sourcePath"), [leads]);
  const assigneeOptions = useMemo(() => {
    const options = new Map(assignableUsers.map((member) => [member.uid, member.name || member.email]));
    leads.forEach((lead) => {
      if (lead.assignedToUid && !options.has(lead.assignedToUid)) {
        options.set(lead.assignedToUid, lead.assignedToName || lead.assignedToEmail || "Vendedor no disponible");
      }
    });
    return Array.from(options, ([uid, label]) => ({ uid, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [assignableUsers, leads]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const matchesQuery =
          !needle ||
          [lead.name, lead.business, lead.email, lead.phone, lead.project].some((value) => value.toLowerCase().includes(needle));
        const matchesStatus = status === "all" || lead.status === status;
        const matchesPriority = priority === "all" || lead.priority === priority;
        const matchesProject = project === "all" || lead.project === project;
        const matchesLocale = locale === "all" || lead.locale === locale;
        const matchesSource = source === "all" || lead.sourcePath === source;
        const matchesAssignee = assignee === "all" || (assignee === "unassigned" ? !lead.assignedToUid : lead.assignedToUid === assignee);
        return matchesQuery && matchesStatus && matchesPriority && matchesProject && matchesLocale && matchesSource && matchesAssignee;
      })
      .sort((a, b) => {
        if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sort === "high_priority") return priorityRank[b.priority] - priorityRank[a.priority] || b.createdAt.localeCompare(a.createdAt);
        if (sort === "estimated_value") return (b.initialProjectAmount || b.estimatedValue) - (a.initialProjectAmount || a.estimatedValue) || b.createdAt.localeCompare(a.createdAt);
        if (sort === "next_followup") return (a.followUpAt || "9999").localeCompare(b.followUpAt || "9999");
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [assignee, leads, locale, priority, project, query, sort, source, status]);

  async function updateLead(id: string, updates: Partial<AdminLead>) {
    if (!canEdit) return;
    const response = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (result.ok && result.lead) {
      setLeads((current) => current.map((lead) => (lead.id === id ? result.lead : lead)));
      showToast("Guardado correctamente.");
      return;
    }
    showToast(result.message || "Error al guardar.", "error");
  }

  async function createQuickTask(lead: AdminLead) {
    if (!canCreateTasks) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Seguimiento con ${lead.name}`,
        description: `Seguimiento comercial para ${lead.project}`,
        leadId: lead.id,
        leadName: lead.name,
        date,
        time: "09:00",
        priority: lead.priority,
        type: "follow_up",
      }),
    });
    showToast(response.ok ? "Tarea creada." : "Error al guardar.", response.ok ? "success" : "error");
  }

  function showToast(message: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function copy(value: string, label: string) {
    navigator.clipboard?.writeText(value);
    showToast(`${label} copiado al portapapeles.`);
  }

  const filtersActive = [status, priority, project, locale, source, assignee].some((value) => value !== "all") || query.trim() !== "";

  return (
    <section className="grid gap-5">
      <Toast message={toast} variant={toastVariant} />

      <div className="kc-admin-card p-4">
        <div className={`grid gap-3 ${canAssign ? "lg:grid-cols-[1fr_repeat(7,minmax(0,170px))]" : "lg:grid-cols-[1fr_repeat(6,minmax(0,170px))]"}`}>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kc-muted" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nombre, empresa, correo o teléfono"
              className="min-h-12 w-full rounded-xl border border-white/10 bg-kc-bg pl-10 pr-4 text-sm text-kc-text outline-none focus:border-kc-cyan"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="all">Estados</option>
            {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="all">Prioridad</option>
            {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={project} onChange={(event) => setProject(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="all">Proyecto</option>
            {projects.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={locale} onChange={(event) => setLocale(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="all">Idioma</option>
            <option value="es">Espanol</option>
            <option value="en">Ingles</option>
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="all">Origen</option>
            {sources.map((value) => <option key={value} value={value}>{leadSourcePageLabel(value)}</option>)}
          </select>
          {canAssign ? <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="all">Todos los vendedores</option>
            <option value="unassigned">Sin asignar</option>
            {assigneeOptions.map((member) => <option key={member.uid} value={member.uid}>{member.label}</option>)}
          </select> : null}
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text outline-none">
            <option value="recent">Más reciente</option>
            <option value="oldest">Más antiguo</option>
            <option value="high_priority">Prioridad alta</option>
            <option value="estimated_value">Valor estimado</option>
            <option value="next_followup">Seguimiento próximo</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-kc-muted">
          <span className="inline-flex items-center gap-2 font-bold"><SlidersHorizontal size={16} aria-hidden="true" /> {filtered.length} de {leads.length} leads</span>
          {filtersActive ? (
            <button type="button" onClick={() => { setQuery(""); setStatus("all"); setPriority("all"); setProject("all"); setLocale("all"); setSource("all"); setAssignee("all"); setSort("recent"); }} className="font-black text-kc-cyan">
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="kc-admin-card p-8 text-center">
          <p className="font-display text-2xl font-black text-kc-text">No hay leads con esos filtros</p>
          <p className="mt-2 text-sm text-kc-muted">Ajusta busqueda, estado, prioridad u origen para ampliar resultados.</p>
        </div>
      ) : null}

      <div className="kc-responsive-table hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] xl:block">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-black uppercase tracking-[0.14em] text-kc-muted">
            <tr>
              <th className="px-4 py-4">Lead</th>
              <th className="px-4 py-4">Estado</th>
              <th className="px-4 py-4">Prioridad</th>
              <th className="px-4 py-4">Valor</th>
              <th className="px-4 py-4">Seguimiento</th>
              <th className="px-4 py-4">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.map((lead) => (
              <tr key={lead.id} className="transition hover:bg-white/[0.035]">
                <td className="px-4 py-4">
                  <Link href={`/admin/leads/${lead.id}`} className="block">
                    <span className="block truncate font-black text-kc-text">{lead.name}</span>
                    <span className="mt-1 block truncate text-sm text-kc-muted">{lead.business} - {lead.project}</span>
                    <span className="mt-2 block truncate text-xs font-bold text-kc-muted">{lead.email || lead.phone}</span>
                    <span className="mt-1 block truncate text-xs font-bold text-kc-cyan">{lead.assignedToName || lead.assignedToEmail || "Sin asignar"}</span>
                  </Link>
                </td>
                <td className="px-4 py-4">
                  {canEdit ? (
                    <select value={lead.status} onChange={(event) => updateLead(lead.id, { status: event.target.value as LeadStatus })} className="min-h-10 w-full rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
                      {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : <LeadStatusBadge status={lead.status} />}
                </td>
                <td className="px-4 py-4">
                  {canEdit ? (
                    <select value={lead.priority} onChange={(event) => updateLead(lead.id, { priority: event.target.value as LeadPriority })} className="min-h-10 w-full rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
                      {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : <LeadPriorityBadge priority={lead.priority} />}
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold text-kc-text">{money(lead.initialProjectAmount || lead.estimatedValue)}</p>
                  {lead.monthlyFee > 0 ? <p className="mt-1 text-xs font-bold text-kc-cyan">{money(lead.monthlyFee)}/mes</p> : null}
                </td>
                <td className="px-4 py-4 text-sm text-kc-muted">{lead.followUpAt ? shortDate(lead.followUpAt) : lead.nextAction || "Sin seguimiento"}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Tooltip label="Ver detalle">
                      <Link href={`/admin/leads/${lead.id}`} title="Ver detalle" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-kc-cyan" aria-label="Ver detalle"><ExternalLink size={16} /></Link>
                    </Tooltip>
                    <Tooltip label="Abrir WhatsApp">
                      <Link href={whatsappLink(`Hola ${lead.name}. Te contacto de Ken Code sobre tu solicitud para ${lead.project}.`)} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp" className="grid h-10 w-10 place-items-center rounded-xl border border-kc-turquoise/30 text-kc-turquoise" aria-label="Abrir WhatsApp"><WhatsAppIcon size={16} /></Link>
                    </Tooltip>
                    {canCreateTasks ? (
                      <Tooltip label="Crear tarea">
                        <button type="button" onClick={() => createQuickTask(lead)} title="Crear tarea" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-kc-text" aria-label="Crear tarea"><CalendarPlus size={16} /></button>
                      </Tooltip>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="kc-mobile-cards grid gap-4 xl:hidden">
        {filtered.map((lead) => (
          <article key={lead.id} className="kc-admin-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <LeadStatusBadge status={lead.status} />
              <LeadPriorityBadge priority={lead.priority} />
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{shortDate(lead.createdAt)}</span>
              <span className="rounded-full border border-kc-cyan/20 bg-kc-cyan/10 px-3 py-1 text-xs font-bold text-kc-cyan">{lead.assignedToName || lead.assignedToEmail || "Sin asignar"}</span>
            </div>
            <h2 className="mt-4 font-display text-2xl font-black text-kc-text">{lead.name}</h2>
            <p className="mt-1 text-sm font-semibold text-kc-cyan">{lead.business}</p>
            <p className="mt-3 text-sm leading-7 text-kc-muted">{lead.project} - {lead.budget || "Por definir"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-kc-bg/50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-kc-muted">Inicial</p>
                <p className="mt-1 font-black text-kc-text">{money(lead.initialProjectAmount || lead.estimatedValue)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-kc-bg/50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-kc-muted">Mensual</p>
                <p className="mt-1 font-black text-kc-text">{lead.monthlyFee > 0 ? `${money(lead.monthlyFee)}/mes` : "Sin mensualidad"}</p>
              </div>
            </div>
            {canEdit ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <select value={lead.status} onChange={(event) => updateLead(lead.id, { status: event.target.value as LeadStatus })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
                  {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={lead.priority} onChange={(event) => updateLead(lead.id, { priority: event.target.value as LeadPriority })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
                  {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link href={`/admin/leads/${lead.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white">
                Ver <ExternalLink size={16} aria-hidden="true" />
              </Link>
              <Link href={whatsappLink(`Hola ${lead.name}. Te contacto de Ken Code sobre tu solicitud para ${lead.project}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-turquoise/35 bg-kc-turquoise/10 px-4 text-sm font-bold text-kc-turquoise">
                <WhatsAppIcon size={17} /> WhatsApp
              </Link>
              <button type="button" onClick={() => copy(lead.phone, "Telefono")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
                <Copy size={16} aria-hidden="true" /> Telefono
              </button>
              <button type="button" onClick={() => copy(lead.email, "Correo")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
                <Mail size={16} aria-hidden="true" /> Correo
              </button>
              {canCreateTasks ? (
                <button type="button" onClick={() => createQuickTask(lead)} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text sm:col-span-1">
                  <CalendarPlus size={16} aria-hidden="true" /> Crear tarea
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
