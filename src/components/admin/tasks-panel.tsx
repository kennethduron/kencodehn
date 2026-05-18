"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AdminLead, AdminTask, TaskPriority, TaskStatus, TaskType } from "@/lib/admin/types";
import { shortDate, taskPriorityLabels, taskStatusLabels, taskTypeLabels } from "./admin-labels";
import { TaskPriorityBadge, TaskStatusBadge } from "./status-badge";

export function TasksPanel({ initialTasks, leads }: { initialTasks: AdminTask[]; leads: AdminLead[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState<TaskType>("follow_up");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  const filtered = useMemo(() => tasks.filter((task) => {
    const statusOk = statusFilter === "all" || task.status === statusFilter;
    const priorityOk = priorityFilter === "all" || task.priority === priorityFilter;
    return statusOk && priorityOk;
  }), [priorityFilter, statusFilter, tasks]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedLead = leads.find((lead) => lead.id === leadId);
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: "",
        leadId: selectedLead?.id ?? null,
        leadName: selectedLead?.name ?? null,
        date,
        time,
        type,
        priority,
      }),
    });
    const result = await response.json();
    if (result.ok) {
      setTasks(result.tasks);
      setTitle("");
      setLeadId("");
      setDate("");
      setTime("09:00");
      setType("follow_up");
      setPriority("medium");
    }
  }

  async function update(id: string, updates: Partial<AdminTask>) {
    const response = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (result.ok) {
      setTasks(result.tasks);
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (result.ok) {
      setTasks(result.tasks);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Tareas</p>
        <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Seguimientos y agenda comercial</h1>
      </div>

      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-6">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titulo de la tarea" className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none lg:col-span-2" required />
        <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none">
          <option value="">Sin lead</option>
          {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none" required />
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none" required />
        <button className="min-h-12 rounded-xl bg-kc-electric px-4 text-sm font-black text-white">Crear</button>
        <select value={type} onChange={(event) => setType(event.target.value as TaskType)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none">
          {Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text outline-none">
          {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </form>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:w-fit lg:grid-cols-2">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text">
          <option value="all">Todos los estados</option>
          {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-4 text-sm text-kc-text">
          <option value="all">Todas las prioridades</option>
          {Object.entries(taskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((task) => (
          <article key={task.id} className="kc-card rounded-2xl p-5">
            <div className="flex flex-wrap gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-black text-kc-text">{task.title}</h2>
            <p className="mt-2 text-sm font-bold text-kc-cyan">{task.leadName || "Sin lead relacionado"}</p>
            <p className="mt-3 text-sm leading-7 text-kc-muted">{task.description || taskTypeLabels[task.type]}</p>
            <p className="mt-3 text-sm font-bold text-kc-text">{shortDate(task.dueAt)} {task.time}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <select value={task.status} onChange={(event) => update(task.id, { status: event.target.value as TaskStatus })} className="min-h-11 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm text-kc-text">
                {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" onClick={() => update(task.id, { status: "completed" })} className="min-h-11 rounded-xl bg-emerald-300 px-3 text-sm font-black text-kc-bg">Completar</button>
              <button type="button" onClick={() => remove(task.id)} className="col-span-2 min-h-11 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 text-sm font-black text-rose-100">Eliminar</button>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-kc-muted">No hay tareas con esos filtros.</p> : null}
      </section>
    </div>
  );
}
