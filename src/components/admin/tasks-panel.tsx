"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Edit3, Ellipsis, Filter, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminLead, AdminTask, TaskAssignee, TaskPriority, TaskStatus, TaskType } from "@/lib/admin/types";
import { shortDate, taskPriorityLabels, taskStatusLabels, taskTypeLabels, timeAgo } from "./admin-labels";
import { TaskPriorityBadge, TaskStatusBadge } from "./status-badge";
import { ConfirmDialog, Toast, Tooltip } from "./ui";
import { addDaysInHonduras, HONDURAS_TIME_ZONE_LABEL, todayInHonduras } from "@/lib/time";

type ViewMode = "list" | "calendar";
type DateFilter = "all" | "today" | "overdue" | "upcoming";

const emptyTask: Partial<AdminTask> = {
  title: "",
  description: "",
  leadId: null,
  leadName: null,
  date: "",
  time: "09:00",
  type: "follow_up",
  priority: "medium",
  status: "pending",
};

function isOverdue(task: AdminTask) {
  return task.status !== "completed" && task.status !== "cancelled" && Boolean(task.dueAt) && new Date(task.dueAt as string) < new Date();
}

function isToday(task: AdminTask) {
  return task.date === todayInHonduras();
}

function weekDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysInHonduras(index);
    return { date, iso: `${date}T12:00:00.000Z` };
  });
}

export function TasksPanel({
  initialTasks,
  leads,
  assignees,
  currentUserUid,
  canAssign,
  canDelete,
}: {
  initialTasks: AdminTask[];
  leads: AdminLead[];
  assignees: TaskAssignee[];
  currentUserUid: string;
  canAssign: boolean;
  canDelete: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [draft, setDraft] = useState<Partial<AdminTask>>(emptyTask);
  const [editing, setEditing] = useState<AdminTask | null>(null);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");
  const [confirmDelete, setConfirmDelete] = useState<AdminTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled").length;
    const today = tasks.filter((task) => isToday(task) && task.status !== "completed" && task.status !== "cancelled").length;
    const overdue = tasks.filter(isOverdue).length;
    const completed = tasks.filter((task) => task.status === "completed").length;
    return { pending, today, overdue, completed };
  }, [tasks]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const statusOk = statusFilter === "all" || task.status === statusFilter;
    const priorityOk = priorityFilter === "all" || task.priority === priorityFilter;
    const typeOk = typeFilter === "all" || task.type === typeFilter;
    const dateOk =
      dateFilter === "all" ||
      (dateFilter === "today" && isToday(task)) ||
      (dateFilter === "overdue" && isOverdue(task)) ||
      (dateFilter === "upcoming" && Boolean(task.dueAt) && new Date(task.dueAt as string) >= new Date() && !isToday(task));
    return statusOk && priorityOk && typeOk && dateOk;
  }).sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999")), [dateFilter, priorityFilter, statusFilter, tasks, typeFilter]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedLead = leads.find((lead) => lead.id === draft.leadId);
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description || "",
        leadId: selectedLead?.id ?? null,
        assignedToUid: canAssign ? draft.assignedToUid || currentUserUid : currentUserUid,
        date: draft.date,
        time: draft.time,
        type: draft.type,
        priority: draft.priority,
        status: draft.status,
      }),
    });
    const result = await response.json();
    if (result.ok) {
      setTasks(result.tasks);
      setDraft(emptyTask);
      showToast("Tarea creada correctamente.");
      return;
    }
    showToast(result.message || "No se pudo guardar. Inténtelo nuevamente.", "error");
  }

  async function update(id: string, updates: Partial<AdminTask>) {
    const payload = {
      title: updates.title,
      description: updates.description,
      leadId: updates.leadId,
      date: updates.date,
      time: updates.time,
      priority: updates.priority,
      status: updates.status,
      type: updates.type,
      assignedToUid: canAssign ? updates.assignedToUid : undefined,
    };
    const response = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (result.ok) {
      setTasks(result.tasks);
      setEditing(null);
      showToast(updates.status === "completed" ? "Tarea completada correctamente." : "Guardado correctamente.");
      return;
    }
    showToast(result.message || "Error al guardar.", "error");
  }

  async function remove(id: string) {
    setIsDeleting(true);
    const response = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    const result = await response.json();
    setIsDeleting(false);
    if (result.ok) {
      setTasks(result.tasks);
      setConfirmDelete(null);
      showToast("Eliminado correctamente.");
      return;
    }
    showToast(result.message || "No se pudo eliminar. Inténtelo nuevamente.", "error");
  }

  async function openLifecycle(task: AdminTask) {
    const response = await fetch(`/api/admin/lifecycle?entity=task&id=${encodeURIComponent(task.id)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return showToast(result.error || "No pudimos revisar esta tarea.", "error");
    if (result.info?.recommendedAction === "delete") return setConfirmDelete(task);
    showToast(result.info?.reason || "Esta tarea debe conservarse como parte del historial. Puede cancelarla desde su estado.", "info");
  }

  function showToast(message: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function taskCard(task: AdminTask) {
    return (
      <article key={task.id} className={`kc-admin-card p-5 ${isOverdue(task) ? "border-rose-300/35" : ""}`}>
        <div className="flex flex-wrap gap-2">
          <TaskStatusBadge status={isOverdue(task) ? "overdue" : task.status} />
          <TaskPriorityBadge priority={task.priority} />
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{taskTypeLabels[task.type]}</span>
        </div>
        <h2 className="mt-4 font-display text-2xl font-black text-kc-text">{task.title}</h2>
        <p className="mt-2 text-sm font-bold text-kc-cyan">{task.leadName || "Sin lead relacionado"}</p>
        <p className="mt-1 text-xs font-bold text-kc-muted">Responsable: {task.assignedToName || task.assignedToEmail || "Sin responsable"}</p>
        <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-kc-muted">{task.description || taskTypeLabels[task.type]}</p>
        <div className="mt-4 rounded-xl border border-white/10 bg-kc-bg/50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-kc-muted">Fecha limite</p>
          <p className="mt-1 text-sm font-bold text-kc-text">{shortDate(task.dueAt)} {task.time}</p>
          {task.completedAt ? <p className="mt-1 text-xs text-kc-muted">Completada {timeAgo(task.completedAt)}</p> : null}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => update(task.id, { status: task.status === "completed" ? "pending" : "completed" })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white">
            <Check size={16} /> {task.status === "completed" ? "Reabrir" : "Completar"}
          </button>
          <button type="button" onClick={() => setEditing(task)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-black text-kc-text">
            <Edit3 size={16} /> Editar
          </button>
          <select value={task.status} onChange={(event) => update(task.id, { status: event.target.value as TaskStatus })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm text-kc-text">
            {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {canDelete ? (
            <button type="button" onClick={() => void openLifecycle(task)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300/30 px-3 text-sm font-black text-kc-text">
              <Ellipsis size={16} /> Más acciones
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <div className="grid gap-6">
      <Toast message={toast} variant={toastVariant} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Tareas</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Agenda comercial</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-kc-muted">Planifica llamadas, reuniones, cotizaciones y seguimientos sin perder vencimientos.</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kc-cyan">Todas las tareas y recordatorios se calculan con la {HONDURAS_TIME_ZONE_LABEL}.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button type="button" onClick={() => setView("list")} className={`min-h-10 rounded-xl px-4 text-sm font-black ${view === "list" ? "bg-kc-cyan/15 text-kc-cyan" : "text-kc-muted"}`}>Lista</button>
          <button type="button" onClick={() => setView("calendar")} className={`min-h-10 rounded-xl px-4 text-sm font-black ${view === "calendar" ? "bg-kc-cyan/15 text-kc-cyan" : "text-kc-muted"}`}>Calendario</button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["Pendientes", stats.pending, Clock3],
          ["Hoy", stats.today, CalendarDays],
          ["Vencidas", stats.overdue, Filter],
          ["Completadas", stats.completed, Check],
        ] as [string, number, LucideIcon][]).map(([label, value, Icon]) => (
          <article key={String(label)} className="kc-admin-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-kc-muted">{String(label)}</p>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-kc-cyan/10 text-kc-cyan"><Icon size={18} /></span>
            </div>
            <p className="mt-4 font-display text-3xl font-black text-kc-text">{String(value)}</p>
          </article>
        ))}
      </section>

      <form onSubmit={create} className="kc-admin-card grid gap-3 p-4 lg:grid-cols-6">
        <input value={draft.title || ""} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Título de la tarea" className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none lg:col-span-2" required />
        <select value={draft.leadId || ""} onChange={(event) => setDraft((current) => ({ ...current, leadId: event.target.value || null }))} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none">
          <option value="">Sin lead</option>
          {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
        </select>
        <input type="date" value={draft.date || ""} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none" required />
        <input type="time" value={draft.time || "09:00"} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none" required />
        {canAssign ? (
          <select value={draft.assignedToUid || currentUserUid} onChange={(event) => setDraft((current) => ({ ...current, assignedToUid: event.target.value }))} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none" required>
            {assignees.map((assignee) => <option key={assignee.uid} value={assignee.uid}>{assignee.name || assignee.email}</option>)}
          </select>
        ) : null}
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white"><Plus size={17} /> Crear</button>
        <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as TaskType }))} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none">
          {Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none">
          {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <textarea value={draft.description || ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Descripción opcional" className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 py-3 text-sm text-kc-text outline-none lg:col-span-4" />
      </form>

      <div className="kc-admin-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text">
          <option value="all">Todos los estados</option>
          {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text">
          <option value="all">Todas las prioridades</option>
          {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text">
          <option value="all">Todos los tipos</option>
          {Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text">
          <option value="all">Todas las fechas</option>
          <option value="today">Hoy</option>
          <option value="overdue">Vencidas</option>
          <option value="upcoming">Próximas</option>
        </select>
      </div>

      {view === "calendar" ? (
        <section className="grid gap-3 lg:grid-cols-7">
          {weekDays().map((day) => {
            const key = day.date;
            const dayTasks = filtered.filter((task) => task.date === key);
            return (
              <article key={key} className="kc-admin-card min-h-44 p-4">
                <p className="font-black text-kc-text">{shortDate(day.iso)}</p>
                <div className="mt-3 grid gap-2">
                  {dayTasks.map((task) => (
                    <button key={task.id} type="button" onClick={() => setEditing(task)} className="rounded-xl border border-white/10 bg-kc-bg/55 p-3 text-left transition hover:border-kc-cyan/30">
                      <span className="block text-sm font-black text-kc-text">{task.title}</span>
                      <span className="mt-1 block text-xs text-kc-muted">{task.time} - {taskTypeLabels[task.type]}</span>
                    </button>
                  ))}
                  {dayTasks.length === 0 ? <p className="text-sm text-kc-muted">Sin tareas</p> : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(taskCard)}
          {filtered.length === 0 ? <p className="kc-admin-card p-6 text-kc-muted">No hay tareas con esos filtros.</p> : null}
        </section>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
          <form role="dialog" aria-modal="true" aria-labelledby="edit-task-title" onSubmit={(event) => { event.preventDefault(); update(editing.id, editing); }} className="kc-admin-card kc-modal-viewport grid w-full max-w-2xl gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="edit-task-title" className="font-display text-2xl font-black text-kc-text">Editar tarea</h2>
              <Tooltip label="Cerrar">
                <button type="button" onClick={() => setEditing(null)} title="Cerrar" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10" aria-label="Cerrar"><X size={17} /></button>
              </Tooltip>
            </div>
            <input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text" required />
            <textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} className="min-h-24 rounded-xl border border-white/10 bg-kc-bg px-4 py-3 text-kc-text" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={editing.leadId || ""} onChange={(event) => setEditing({ ...editing, leadId: event.target.value || null })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text">
                <option value="">Sin lead</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
              </select>
              <select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as TaskType })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text">
                {Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text" required />
              <input type="time" value={editing.time} onChange={(event) => setEditing({ ...editing, time: event.target.value })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text" required />
              <select value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: event.target.value as TaskPriority })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text">
                {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as TaskStatus })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text">
                {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {canAssign ? (
                <select value={editing.assignedToUid || currentUserUid} onChange={(event) => setEditing({ ...editing, assignedToUid: event.target.value })} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-kc-text" required>
                  {assignees.map((assignee) => <option key={assignee.uid} value={assignee.uid}>{assignee.name || assignee.email}</option>)}
                </select>
              ) : null}
            </div>
            <button className="min-h-12 rounded-xl bg-kc-electric px-4 text-sm font-black text-white">Guardar cambios</button>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Eliminar “${confirmDelete?.title ?? "esta tarea"}”`}
        description="Esta tarea no tiene actividad relacionada. Si continúa se eliminará definitivamente."
        confirmText="Eliminar definitivamente"
        cancelText="Cancelar"
        variant="danger"
        loading={isDeleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete ? remove(confirmDelete.id) : undefined}
      />
    </div>
  );
}
