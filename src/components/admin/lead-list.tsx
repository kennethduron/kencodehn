"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Mail, Search } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import type { AdminLead, LeadPriority, LeadStatus } from "@/lib/admin/types";
import { whatsappLink } from "@/lib/site";
import { leadPriorityLabels, leadStatusLabels, shortDate } from "./admin-labels";
import { LeadPriorityBadge, LeadStatusBadge } from "./status-badge";

const statuses = Object.entries(leadStatusLabels) as [LeadStatus, string][];
const priorities = Object.entries(leadPriorityLabels) as [LeadPriority, string][];

export function LeadList({ initialLeads }: { initialLeads: AdminLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesQuery =
        !needle ||
        [lead.name, lead.business, lead.email, lead.phone, lead.project].some((value) => value.toLowerCase().includes(needle));
      const matchesStatus = status === "all" || lead.status === status;
      const matchesPriority = priority === "all" || lead.priority === priority;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [leads, priority, query, status]);

  async function updateLead(id: string, updates: Partial<AdminLead>) {
    const response = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (result.ok && result.lead) {
      setLeads((current) => current.map((lead) => (lead.id === id ? result.lead : lead)));
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value);
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kc-muted" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, empresa, correo, telefono o proyecto"
            className="min-h-12 w-full rounded-xl border border-white/10 bg-kc-bg pl-10 pr-4 text-sm text-kc-text outline-none focus:border-kc-cyan"
          />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm font-bold text-kc-text outline-none">
          <option value="all">Todos los estados</option>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm font-bold text-kc-text outline-none">
          <option value="all">Todas las prioridades</option>
          {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-kc-muted">No hay leads con esos filtros.</div>
        ) : null}
        {filtered.map((lead) => (
          <article key={lead.id} className="kc-card rounded-2xl p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <LeadStatusBadge status={lead.status} />
                  <LeadPriorityBadge priority={lead.priority} />
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{shortDate(lead.createdAt)}</span>
                </div>
                <h2 className="mt-4 font-display text-2xl font-black text-kc-text">{lead.name}</h2>
                <p className="mt-1 text-sm font-semibold text-kc-cyan">{lead.business}</p>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-kc-muted">{lead.project} - {lead.budget || "Presupuesto sin definir"}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-72">
                <select value={lead.status} onChange={(event) => updateLead(lead.id, { status: event.target.value as LeadStatus })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
                  {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={lead.priority} onChange={(event) => updateLead(lead.id, { priority: event.target.value as LeadPriority })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
                  {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/admin/leads/${lead.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white transition hover:bg-kc-cyan hover:text-kc-bg">
                Ver detalle
                <ExternalLink size={16} aria-hidden="true" />
              </Link>
              <Link href={whatsappLink(`Hola ${lead.name}. Te contacto de Ken Code sobre tu solicitud para ${lead.project}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-turquoise/35 bg-kc-turquoise/10 px-4 text-sm font-bold text-kc-turquoise">
                <WhatsAppIcon size={17} />
                WhatsApp
              </Link>
              <Link href={`mailto:${lead.email}?subject=Solicitud Ken Code&body=Hola ${lead.name},`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
                <Mail size={16} aria-hidden="true" />
                Correo
              </Link>
              <button type="button" onClick={() => copy(lead.phone)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
                <Copy size={16} aria-hidden="true" />
                Copiar telefono
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
