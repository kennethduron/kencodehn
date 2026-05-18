"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import type { AdminLead, AdminNote, AdminTask, LeadPriority, LeadStatus } from "@/lib/admin/types";
import { whatsappLink } from "@/lib/site";
import { dateTime, leadPriorityLabels, leadStatusLabels, shortDate, taskTypeLabels } from "./admin-labels";
import { LeadPriorityBadge, LeadStatusBadge, TaskStatusBadge } from "./status-badge";

export function LeadDetail({ initialLead, initialNotes, initialTasks }: { initialLead: AdminLead; initialNotes: AdminNote[]; initialTasks: AdminTask[] }) {
  const [lead, setLead] = useState(initialLead);
  const [notes, setNotes] = useState(initialNotes);
  const [tasks, setTasks] = useState(initialTasks);
  const [noteText, setNoteText] = useState("");
  const [taskTitle, setTaskTitle] = useState("Seguimiento");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");

  async function updateLead(updates: Partial<AdminLead>) {
    const response = await fetch(`/api/admin/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (result.ok && result.lead) {
      setLead(result.lead);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/admin/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noteText }),
    });
    const result = await response.json();
    if (result.ok) {
      setNotes(result.notes);
      setNoteText("");
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    }
  }

  return (
    <div className="grid gap-6">
      <Link href="/admin/leads" className="inline-flex w-fit items-center gap-2 text-sm font-black text-kc-cyan hover:text-kc-turquoise">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a leads
      </Link>

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap gap-2">
            <LeadStatusBadge status={lead.status} />
            <LeadPriorityBadge priority={lead.priority} />
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{shortDate(lead.createdAt)}</span>
          </div>
          <h1 className="mt-5 font-display text-4xl font-black text-kc-text">{lead.name}</h1>
          <p className="mt-2 text-lg font-bold text-kc-cyan">{lead.business}</p>
          <p className="mt-5 whitespace-pre-wrap text-base leading-8 text-kc-muted">{lead.message}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["WhatsApp", lead.phone],
              ["Correo", lead.email],
              ["Proyecto", lead.project],
              ["Presupuesto", lead.budget || "Sin definir"],
              ["Idioma", lead.locale.toUpperCase()],
              ["Origen", lead.sourcePath],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">{label}</p>
                <p className="mt-2 text-sm font-bold text-kc-text">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={whatsappLink(`Hola ${lead.name}. Te contacto de Ken Code sobre tu solicitud para ${lead.project}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-kc-turquoise px-4 text-sm font-black text-kc-bg">
              <WhatsAppIcon size={18} />
              Abrir WhatsApp
            </Link>
            <Link href={`mailto:${lead.email}?subject=Solicitud Ken Code`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold text-kc-text">
              <Mail size={16} aria-hidden="true" />
              Enviar correo
            </Link>
          </div>
        </article>

        <aside className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
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
                <input type="number" defaultValue={lead.estimatedValue} onBlur={(event) => updateLead({ estimatedValue: Number(event.target.value) })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-kc-muted">
                Proxima accion
                <input defaultValue={lead.nextAction} onBlur={(event) => updateLead({ nextAction: event.target.value })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateLead({ status: "won", wonValue: lead.estimatedValue || lead.wonValue })} className="min-h-11 rounded-xl bg-emerald-300 px-3 text-sm font-black text-kc-bg">Ganado</button>
                <button type="button" onClick={() => updateLead({ status: "lost" })} className="min-h-11 rounded-xl bg-rose-300 px-3 text-sm font-black text-kc-bg">Perdido</button>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="font-display text-2xl font-black text-kc-text">Notas internas</h2>
          <form className="mt-4 grid gap-3" onSubmit={addNote}>
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={4} placeholder="Agregar nota privada..." className="rounded-xl border border-white/10 bg-kc-bg p-4 text-sm text-kc-text outline-none focus:border-kc-cyan" required />
            <button className="min-h-11 rounded-xl bg-kc-electric px-4 text-sm font-black text-white">Agregar nota</button>
          </form>
          <div className="mt-5 grid gap-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-kc-text">{note.text}</p>
                <p className="mt-3 text-xs font-bold text-kc-muted">{note.createdByEmail} - {dateTime(note.createdAt)}</p>
              </div>
            ))}
            {notes.length === 0 ? <p className="text-sm text-kc-muted">No hay notas todavia.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="font-display text-2xl font-black text-kc-text">Tareas y seguimientos</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={addTask}>
            <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text sm:col-span-2" required />
            <input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" required />
            <input type="time" value={taskTime} onChange={(event) => setTaskTime(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" required />
            <button className="min-h-11 rounded-xl bg-kc-electric px-4 text-sm font-black text-white sm:col-span-2">Crear tarea</button>
          </form>
          <div className="mt-5 grid gap-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                <div className="flex flex-wrap gap-2">
                  <TaskStatusBadge status={task.status} />
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{taskTypeLabels[task.type]}</span>
                </div>
                <p className="mt-3 font-bold text-kc-text">{task.title}</p>
                <p className="mt-1 text-sm text-kc-muted">{task.date} {task.time}</p>
              </div>
            ))}
            {tasks.length === 0 ? <p className="text-sm text-kc-muted">No hay tareas para este lead.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
