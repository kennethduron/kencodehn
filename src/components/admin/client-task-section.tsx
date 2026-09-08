"use client";

import { CalendarPlus, ClipboardList, X } from "lucide-react";
import { useState } from "react";
import type { AdminMember, TaskPriority, TaskType } from "@/lib/admin/types";
import { taskPriorityLabels, taskStatusLabels, taskTypeLabels } from "./admin-labels";
import { TaskPriorityBadge, TaskStatusBadge } from "./status-badge";

export type ClientTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  type?: string;
  due_at?: string | null;
  dueAt?: string | null;
  date?: string;
  time?: string;
  assignedToName?: string | null;
  assigned_to_name?: string | null;
};

export function ClientTaskSection({ client, initialTasks, members, currentUserUid, canEdit, canAssign }: {
  client: { id: string; name: string; company: string };
  initialTasks: ClientTask[];
  members: AdminMember[];
  currentUserUid: string;
  canEdit: boolean;
  canAssign: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [draft, setDraft] = useState({ title: "Seguimiento", description: "", date: "", time: "09:00", type: "follow_up" as TaskType, priority: "medium" as TaskPriority, assignedToUid: currentUserUid });
  const assignees = members.filter((member) => member.active && ["owner", "admin", "sales_agent"].includes(member.role || ""));
  const relationName = client.company || client.name;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, relationType: "client", relationId: client.id, assignedToUid: canAssign ? draft.assignedToUid : currentUserUid, status: "pending" }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || "No se pudo crear la tarea.");
      const refreshed = await fetch(`/api/admin/tasks?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
      const refreshedBody = await refreshed.json();
      if (refreshed.ok && refreshedBody.ok) setTasks(refreshedBody.tasks || []);
      setDraft({ title: "Seguimiento", description: "", date: "", time: "09:00", type: "follow_up", priority: "medium", assignedToUid: currentUserUid });
      setOpen(false);
      setFeedback("Tarea creada y relacionada con este cliente.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo crear la tarea.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-display text-2xl font-black text-kc-text">Tareas del cliente</h2><p className="mt-1 text-sm text-kc-muted">Una sola tarea se mostrará aquí y en la agenda global.</p></div>
        {canEdit ? <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white"><CalendarPlus size={17} /> Nueva tarea</button> : null}
      </div>
      {open ? (
        <form onSubmit={create} className="kc-admin-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start justify-between gap-3 sm:col-span-2 lg:col-span-3">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-kc-cyan">Relacionado con</p><p className="mt-1 font-black text-kc-text">Cliente · {relationName}</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar nueva tarea" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10"><X size={17} /></button>
          </div>
          <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2">Título<input required minLength={2} maxLength={180} value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" /></label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">Fecha<input required type="date" value={draft.date} onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" /></label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">Hora<input required type="time" value={draft.time} onChange={(event) => setDraft((value) => ({ ...value, time: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text" /></label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">Responsable<select required value={canAssign ? draft.assignedToUid : currentUserUid} disabled={!canAssign} onChange={(event) => setDraft((value) => ({ ...value, assignedToUid: event.target.value }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text">{assignees.filter((member) => canAssign || member.uid === currentUserUid).map((member) => <option key={member.uid} value={member.uid}>{member.name || member.email}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">Tipo<select value={draft.type} onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value as TaskType }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text">{Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">Prioridad<select value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value as TaskPriority }))} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-kc-text">{Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2 lg:col-span-3">Descripción<textarea rows={3} maxLength={1200} value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} className="rounded-xl border border-white/10 bg-kc-bg p-3 text-kc-text" /></label>
          <button disabled={saving} className="min-h-11 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2 lg:col-span-3">{saving ? "Guardando…" : "Crear tarea"}</button>
        </form>
      ) : null}
      {feedback ? <p role="status" className="text-sm font-bold text-kc-cyan">{feedback}</p> : null}
      {tasks.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => (
        <article key={task.id} className="kc-admin-card p-4">
          <div className="flex flex-wrap items-center gap-2"><ClipboardList size={18} className="text-kc-cyan" /><TaskStatusBadge status={task.status as keyof typeof taskStatusLabels} /><TaskPriorityBadge priority={task.priority as TaskPriority} /></div>
          <h3 className="mt-3 font-black text-kc-text">{task.title}</h3>
          <p className="mt-2 text-sm text-kc-muted">{task.dueAt || task.due_at ? new Intl.DateTimeFormat("es-HN", { dateStyle: "short", timeStyle: "short", timeZone: "America/Tegucigalpa" }).format(new Date(task.dueAt || task.due_at || "")) : [task.date, task.time].filter(Boolean).join(" ") || "Sin fecha"}</p>
          <p className="mt-1 text-xs font-bold text-kc-muted">Responsable: {task.assignedToName || task.assigned_to_name || "Sin responsable"}</p>
        </article>
      ))}</div> : <div className="kc-admin-card grid min-h-52 place-items-center p-8 text-center"><div><CalendarPlus className="mx-auto text-kc-cyan" size={30} /><p className="mt-3 font-black text-kc-text">Sin tareas del cliente</p><p className="mt-1 text-sm text-kc-muted">Cree una tarea y el cliente quedará preseleccionado.</p></div></div>}
    </section>
  );
}
