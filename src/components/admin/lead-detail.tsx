"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, CalendarPlus, CheckCircle2, Copy, Mail, Plus, Tag, Trash2, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import type { ActivityLog, AdminLead, AdminNote, AdminTask, LeadPriority, LeadStatus, PaymentStatus } from "@/lib/admin/types";
import { mapActivityTone } from "@/lib/admin/activity";
import { whatsappLink } from "@/lib/site";
import { HONDURAS_TIME_ZONE, hondurasDateTimeToIso } from "@/lib/time";
import { dateTime, leadPriorityLabels, leadStatusLabels, money, paymentStatusLabels, shortDate, taskTypeLabels, timeAgo } from "./admin-labels";
import { LeadPriorityBadge, LeadStatusBadge, TaskPriorityBadge, TaskStatusBadge } from "./status-badge";
import { ConfirmDialog, Toast, Tooltip } from "./ui";

const suggestedTags = ["urgente", "restaurante", "e-commerce", "seguimiento", "cotizacion", "interesado", "frio", "caliente"];

export function LeadDetail({
  initialLead,
  initialNotes,
  initialTasks,
  initialActivity,
  canEditLead,
  canViewNotes,
  canEditNotes,
  canViewTasks,
  canEditTasks,
  canViewActivity,
  canDeleteLead,
}: {
  initialLead: AdminLead;
  initialNotes: AdminNote[];
  initialTasks: AdminTask[];
  initialActivity: ActivityLog[];
  canEditLead: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
  canViewTasks: boolean;
  canEditTasks: boolean;
  canViewActivity: boolean;
  canDeleteLead: boolean;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [notes, setNotes] = useState(initialNotes);
  const [tasks, setTasks] = useState(initialTasks);
  const [activity, setActivity] = useState(initialActivity);
  const [noteText, setNoteText] = useState("");
  const [taskTitle, setTaskTitle] = useState("Seguimiento");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");
  const [followUpDate, setFollowUpDate] = useState(initialLead.followUpDate);
  const [followUpTime, setFollowUpTime] = useState(initialLead.followUpTime);
  const [tagInput, setTagInput] = useState("");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [deleteLeadOpen, setDeleteLeadOpen] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);

  const timeline = useMemo(() => {
    const createdItem: ActivityLog = {
      id: `created-${lead.id}`,
      entityType: "lead",
      entityId: lead.id,
      leadId: lead.id,
      action: "lead_created",
      title: "Lead creado",
      description: "Solicitud recibida desde el sitio publico.",
      before: null,
      after: null,
      userEmail: "Sitio publico",
      createdAt: lead.createdAt,
    };
    return [createdItem, ...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activity, lead.createdAt, lead.id]);

  async function refreshActivity() {
    if (!canViewActivity) return;
    const response = await fetch(`/api/admin/leads/${lead.id}/activity`);
    const result = await response.json();
    if (result.ok) {
      setActivity(result.activity);
    }
  }

  async function updateLead(updates: Partial<AdminLead>) {
    if (!canEditLead) return;
    const response = await fetch(`/api/admin/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (result.ok && result.lead) {
      setLead(result.lead);
      await refreshActivity();
      showToast("Guardado correctamente.");
      return;
    }
    showToast(result.message || "Error al guardar.", "error");
  }

  async function saveFollowUp(nextDate = followUpDate, nextTime = followUpTime) {
    const date = nextDate.trim();
    const time = nextTime.trim();
    if (!date && !time) {
      await updateLead({ followUpDate: "", followUpTime: "", followUpTimezone: HONDURAS_TIME_ZONE, followUpAt: null });
      return;
    }
    if (!date && time) {
      showToast("Selecciona una fecha para guardar la hora de seguimiento.", "error");
      return;
    }
    const resolvedTime = time || "09:00";
    const followUpAt = hondurasDateTimeToIso(date, resolvedTime);
    if (!followUpAt) {
      showToast("Fecha u hora de seguimiento invalida.", "error");
      return;
    }
    setFollowUpTime(resolvedTime);
    await updateLead({
      followUpDate: date,
      followUpTime: resolvedTime,
      followUpTimezone: HONDURAS_TIME_ZONE,
      followUpAt,
    });
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditNotes) return;
    setIsSavingNote(true);
    const response = await fetch(`/api/admin/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText }),
    });
    const result = await response.json();
    setIsSavingNote(false);
    if (result.ok) {
      setNotes(result.notes);
      setNoteText("");
      await refreshActivity();
      showToast("Nota agregada.");
      return;
    }
    showToast(result.message || "Error al guardar.", "error");
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditTasks) return;
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskTitle,
        description: `Seguimiento para ${lead.name}`,
        leadId: lead.id,
        leadName: lead.name,
        date: taskDate,
        time: taskTime,
        priority: lead.priority,
        type: "follow_up",
      }),
    });
    const result = await response.json();
    if (result.ok) {
      const taskResponse = await fetch(`/api/admin/tasks?leadId=${lead.id}`);
      const taskResult = await taskResponse.json();
      if (taskResult.ok) {
        setTasks(taskResult.tasks);
      }
      setTaskTitle("Seguimiento");
      setTaskDate("");
      setTaskTime("09:00");
      await refreshActivity();
      showToast("Tarea creada.");
      return;
    }
    showToast(result.message || "Error al guardar.", "error");
  }

  function addTag(value: string) {
    const tag = value.trim().toLowerCase();
    if (!tag || lead.tags.includes(tag)) return;
    updateLead({ tags: [...lead.tags, tag].slice(0, 12) });
    setTagInput("");
  }

  function removeTag(value: string) {
    updateLead({ tags: lead.tags.filter((tag) => tag !== value) });
  }

  function copy(value: string, label: string) {
    navigator.clipboard?.writeText(value);
    showToast(`${label} copiado al portapapeles.`);
  }

  function showToast(message: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function deleteLead() {
    if (!canDeleteLead) return;
    setIsDeletingLead(true);
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "No se pudo eliminar el lead.");
      }
      showToast("Lead eliminado correctamente.");
      setDeleteLeadOpen(false);
      router.push("/admin/leads");
      router.refresh();
    } catch {
      showToast("No se pudo eliminar el lead. Intentalo nuevamente.", "error");
    } finally {
      setIsDeletingLead(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Toast message={toast} variant={toastVariant} />
      <ConfirmDialog
        open={deleteLeadOpen}
        title="Eliminar este lead?"
        description="Esta accion eliminara la solicitud, notas, tareas relacionadas, notificaciones relacionadas y actividad asociada. Esta accion no se puede deshacer."
        confirmText="Si, eliminar"
        cancelText="Cancelar"
        variant="danger"
        loading={isDeletingLead}
        onCancel={() => setDeleteLeadOpen(false)}
        onConfirm={deleteLead}
      />

      <Link href="/admin/leads" className="inline-flex w-fit items-center gap-2 text-sm font-black text-kc-cyan hover:text-kc-turquoise">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a leads
      </Link>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <article className="kc-admin-card p-6">
          <div className="flex flex-wrap gap-2">
            <LeadStatusBadge status={lead.status} />
            <LeadPriorityBadge priority={lead.priority} />
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{shortDate(lead.createdAt)}</span>
          </div>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-black text-kc-text sm:text-4xl">{lead.name}</h1>
              <p className="mt-2 text-lg font-bold text-kc-cyan">{lead.business}</p>
              <p className="mt-2 text-sm text-kc-muted">{lead.project} - {lead.budget || "Por definir"}</p>
            </div>
            <div className="rounded-2xl border border-kc-lime/20 bg-kc-lime/10 p-4 lg:min-w-44">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kc-lime">Monto inicial</p>
              <p className="mt-2 font-display text-3xl font-black text-kc-text">{money(lead.initialProjectAmount || lead.estimatedValue)}</p>
              <p className="mt-1 text-xs font-bold text-kc-muted">{lead.monthlyFee > 0 ? `${money(lead.monthlyFee)}/mes` : "Sin mensualidad"}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Telefono", lead.phone],
              ["Correo", lead.email],
              ["Idioma", lead.locale.toUpperCase()],
              ["Origen", lead.sourcePath],
              ["Ultimo contacto", lead.lastContactAt ? dateTime(lead.lastContactAt) : "Sin registrar"],
              ["Seguimiento", lead.followUpAt ? dateTime(lead.followUpAt) : "Sin fecha"],
              ["Estado de pago", paymentStatusLabels[lead.paymentStatus]],
              ["Inicio mensualidad", lead.billingStartDate ? shortDate(lead.billingStartDate) : "Sin fecha"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-kc-muted">{label}</p>
                <p className="mt-2 break-words text-sm font-bold text-kc-text">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-kc-bg/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kc-muted">Mensaje original</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-kc-text">{lead.message || "Sin mensaje."}</p>
          </div>

          <div className="mt-6 rounded-2xl border border-kc-cyan/20 bg-kc-cyan/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kc-cyan">Gestion de cobro</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">Inicial</p>
                <p className="mt-1 font-display text-2xl font-black text-kc-text">{money(lead.initialProjectAmount || lead.estimatedValue)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">Mensualidad</p>
                <p className="mt-1 font-display text-2xl font-black text-kc-text">{lead.monthlyFee > 0 ? `${money(lead.monthlyFee)}/mes` : "Sin mensualidad"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">Pago</p>
                <p className="mt-1 font-display text-2xl font-black text-kc-text">{paymentStatusLabels[lead.paymentStatus]}</p>
              </div>
            </div>
            {lead.billingNotes ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-kc-muted">{lead.billingNotes}</p> : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={whatsappLink(`Hola ${lead.name}. Te contacto de Ken Code sobre tu solicitud para ${lead.project}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-kc-turquoise px-4 text-sm font-black text-kc-bg">
              <WhatsAppIcon size={18} />
              WhatsApp
            </Link>
            <Link href={`mailto:${lead.email}?subject=Solicitud Ken Code`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
              <Mail size={16} aria-hidden="true" />
              Correo
            </Link>
            <button type="button" onClick={() => copy(lead.phone, "Telefono")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
              <Copy size={16} aria-hidden="true" />
              Telefono
            </button>
            <button type="button" onClick={() => copy(lead.email, "Correo")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
              <Copy size={16} aria-hidden="true" />
              Correo
            </button>
          </div>
        </article>

        {canEditLead || canDeleteLead ? <aside className="grid gap-4">
          <div className="kc-admin-card p-5">
            <h2 className="font-display text-xl font-black text-kc-text">Gestion comercial</h2>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Estado
                <select value={lead.status} onChange={(event) => updateLead({ status: event.target.value as LeadStatus })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text">
                  {Object.entries(leadStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Prioridad
                <select value={lead.priority} onChange={(event) => updateLead({ priority: event.target.value as LeadPriority })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text">
                  {Object.entries(leadPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Valor estimado
                <input type="number" min="0" value={lead.estimatedValue} onChange={(event) => setLead((current) => ({ ...current, estimatedValue: Number(event.target.value) }))} onBlur={(event) => updateLead({ estimatedValue: Number(event.target.value) })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Monto inicial del proyecto
                <input type="number" min="0" value={lead.initialProjectAmount} onChange={(event) => setLead((current) => ({ ...current, initialProjectAmount: Number(event.target.value) }))} onBlur={(event) => updateLead({ initialProjectAmount: Number(event.target.value) })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Mensualidad
                <input type="number" min="0" value={lead.monthlyFee} onChange={(event) => setLead((current) => ({ ...current, monthlyFee: Number(event.target.value) }))} onBlur={(event) => updateLead({ monthlyFee: Number(event.target.value) })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Estado de pago
                <select value={lead.paymentStatus} onChange={(event) => updateLead({ paymentStatus: event.target.value as PaymentStatus })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text">
                  {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Inicio de mensualidad
                <input type="date" value={lead.billingStartDate ? lead.billingStartDate.slice(0, 10) : ""} onChange={(event) => updateLead({ billingStartDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : null })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Notas de cobro
                <textarea value={lead.billingNotes} onChange={(event) => setLead((current) => ({ ...current, billingNotes: event.target.value }))} onBlur={(event) => updateLead({ billingNotes: event.target.value })} rows={3} className="rounded-xl border border-white/10 bg-kc-bg px-3 py-3 text-kc-text" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Proxima accion
                <input value={lead.nextAction} onChange={(event) => setLead((current) => ({ ...current, nextAction: event.target.value }))} onBlur={(event) => updateLead({ nextAction: event.target.value })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-kc-muted">
                  Fecha de seguimiento
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                    onBlur={() => saveFollowUp()}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text outline-none focus:border-kc-cyan"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-kc-muted">
                  Hora de seguimiento
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={(event) => setFollowUpTime(event.target.value)}
                    onBlur={() => saveFollowUp()}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text outline-none focus:border-kc-cyan"
                  />
                </label>
                <div className="sm:col-span-2">
                  <p className="text-xs leading-5 text-kc-muted">
                    Se calcula con hora de Honduras. {lead.followUpAt ? `Actual: ${dateTime(lead.followUpAt)} hora de Honduras.` : "Sin seguimiento programado."}
                  </p>
                  <button type="button" onClick={() => { setFollowUpDate(""); setFollowUpTime(""); saveFollowUp("", ""); }} className="mt-2 text-xs font-black text-kc-cyan hover:text-kc-turquoise">
                    Limpiar seguimiento
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateLead({ status: "won", wonValue: lead.initialProjectAmount || lead.estimatedValue || lead.wonValue, paymentStatus: lead.monthlyFee > 0 ? "active" : lead.paymentStatus })} className="min-h-11 rounded-xl bg-emerald-300 px-3 text-sm font-black text-kc-bg">Ganado</button>
                <button type="button" onClick={() => updateLead({ status: "lost" })} className="min-h-11 rounded-xl bg-rose-300 px-3 text-sm font-black text-kc-bg">Perdido</button>
              </div>
            </div>
          </div>

          <div className="kc-admin-card p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-black text-kc-text"><Tag size={18} /> Tags</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {lead.tags.map((tag) => (
                <button key={tag} type="button" onClick={() => removeTag(tag)} className="inline-flex items-center gap-1 rounded-full border border-kc-cyan/25 bg-kc-cyan/10 px-3 py-1 text-xs font-black text-kc-cyan">
                  {tag} <X size={13} aria-hidden="true" />
                </button>
              ))}
              {lead.tags.length === 0 ? <p className="text-sm text-kc-muted">Sin tags todavia.</p> : null}
            </div>
            <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); addTag(tagInput); }}>
              <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Nuevo tag" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm text-kc-text" />
              <Tooltip label="Agregar tag">
                <button className="grid h-11 w-11 place-items-center rounded-xl bg-kc-electric text-white" aria-label="Agregar tag" title="Agregar tag"><Plus size={17} /></button>
              </Tooltip>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedTags.filter((tag) => !lead.tags.includes(tag)).map((tag) => (
                <button key={tag} type="button" onClick={() => addTag(tag)} className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted transition hover:border-kc-cyan/35 hover:text-kc-cyan">{tag}</button>
              ))}
            </div>
          </div>

          {canDeleteLead ? <div className="kc-admin-card border-rose-300/20 bg-rose-950/10 p-5">
            <h2 className="font-display text-xl font-black text-rose-100">Zona peligrosa</h2>
            <p className="mt-2 text-sm leading-6 text-rose-100/75">
              Elimina este lead y todos sus datos relacionados solo cuando sea informacion de prueba o duplicada.
            </p>
            <button
              type="button"
              onClick={() => setDeleteLeadOpen(true)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-300 px-4 text-sm font-black text-kc-bg transition hover:bg-rose-200"
            >
              <Trash2 size={16} aria-hidden="true" />
              Eliminar lead
            </button>
          </div> : null}
        </aside> : null}
      </section>

      {canViewNotes || canViewTasks ? <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        {canViewNotes ? <article className="kc-admin-card p-5">
          <h2 className="font-display text-2xl font-black text-kc-text">Notas internas</h2>
          {canEditNotes ? <form className="mt-4 grid gap-3" onSubmit={addNote}>
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={4} placeholder="Agregar nota privada..." className="rounded-xl border border-white/10 bg-kc-bg p-4 text-sm text-kc-text outline-none focus:border-kc-cyan" required />
            <button disabled={isSavingNote} className="min-h-11 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:opacity-60">{isSavingNote ? "Guardando..." : "Agregar nota"}</button>
          </form> : null}
          <div className="mt-5 grid gap-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-kc-text">{note.text}</p>
                <p className="mt-3 text-xs font-bold text-kc-muted">{note.createdByEmail} - {timeAgo(note.createdAt)}</p>
              </div>
            ))}
            {notes.length === 0 ? <p className="rounded-xl border border-dashed border-white/12 p-5 text-sm text-kc-muted">No hay notas todavia.</p> : null}
          </div>
        </article> : null}

        {canViewTasks ? <article className="kc-admin-card p-5">
          <h2 className="font-display text-2xl font-black text-kc-text">Tareas relacionadas</h2>
          {canEditTasks ? <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addTask}>
            <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text sm:col-span-2" required />
            <input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" required />
            <input type="time" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" required />
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white sm:col-span-2"><CalendarPlus size={16} /> Crear tarea</button>
          </form> : null}
          <div className="mt-5 grid gap-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                <div className="flex flex-wrap gap-2">
                  <TaskStatusBadge status={task.status} />
                  <TaskPriorityBadge priority={task.priority} />
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{taskTypeLabels[task.type]}</span>
                </div>
                <p className="mt-3 font-bold text-kc-text">{task.title}</p>
                <p className="mt-1 text-sm text-kc-muted">{task.date} {task.time}</p>
              </div>
            ))}
            {tasks.length === 0 ? <p className="rounded-xl border border-dashed border-white/12 p-5 text-sm text-kc-muted">No hay tareas para este lead.</p> : null}
          </div>
        </article> : null}
      </section> : null}

      {canViewActivity ? <section className="kc-admin-card p-5">
        <h2 className="font-display text-2xl font-black text-kc-text">Timeline de actividad</h2>
        <div className="mt-5 grid gap-4">
          {timeline.map((item) => {
            const tone = mapActivityTone(item);
            const toneClass = tone === "danger" ? "border-rose-300/25 bg-rose-300/10 text-rose-200" : tone === "warning" ? "border-kc-lime/25 bg-kc-lime/10 text-kc-lime" : tone === "success" ? "border-kc-turquoise/25 bg-kc-turquoise/10 text-kc-turquoise" : "border-kc-cyan/25 bg-kc-cyan/10 text-kc-cyan";
            return (
            <div key={item.id} className="grid grid-cols-[auto_1fr] gap-4">
              <span className={`mt-1 grid h-8 w-8 place-items-center rounded-full border ${toneClass}`}><CheckCircle2 size={16} /></span>
              <div className="rounded-xl border border-white/10 bg-kc-bg/50 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <p className="font-black text-kc-text">{item.title}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">{timeAgo(item.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-kc-muted">{item.description}</p>
                <p className="mt-1 text-sm text-kc-muted">{item.userEmail || "Sistema"} - {dateTime(item.createdAt)}</p>
              </div>
            </div>
          )})}
        </div>
      </section> : null}
    </div>
  );
}
