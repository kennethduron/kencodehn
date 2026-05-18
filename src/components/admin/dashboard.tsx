import Link from "next/link";
import { Bell, CalendarClock, CircleDollarSign, TrendingUp, Users } from "lucide-react";
import type { AdminLead, AdminNotification, AdminTask } from "@/lib/admin/types";
import { money } from "./admin-labels";
import { LeadList } from "./lead-list";

function statClass() {
  return "rounded-2xl border border-white/10 bg-white/[0.04] p-5";
}

export function AdminDashboard({ leads, tasks, notifications }: { leads: AdminLead[]; tasks: AdminTask[]; notifications: AdminNotification[] }) {
  const total = leads.length;
  const newLeads = leads.filter((lead) => lead.status === "new").length;
  const contacted = leads.filter((lead) => lead.status === "contacted").length;
  const conversation = leads.filter((lead) => lead.status === "conversation").length;
  const quoted = leads.filter((lead) => lead.status === "quoted").length;
  const won = leads.filter((lead) => lead.status === "won").length;
  const lost = leads.filter((lead) => lead.status === "lost").length;
  const pendingTasks = tasks.filter((task) => task.status !== "completed").length;
  const overdueTasks = tasks.filter((task) => task.status === "overdue" || (task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "completed")).length;
  const potentialValue = leads.reduce((sum, lead) => sum + lead.estimatedValue, 0);
  const wonValue = leads.reduce((sum, lead) => sum + lead.wonValue, 0);
  const conversion = total ? Math.round((won / total) * 100) : 0;
  const unread = notifications.filter((notification) => !notification.read).length;

  const cards = [
    { label: "Total de leads", value: total, icon: Users },
    { label: "Leads nuevos", value: newLeads, icon: TrendingUp },
    { label: "Contactados", value: contacted, icon: Users },
    { label: "En conversacion", value: conversation, icon: Users },
    { label: "Cotizacion enviada", value: quoted, icon: CircleDollarSign },
    { label: "Ganados", value: won, icon: TrendingUp },
    { label: "Perdidos", value: lost, icon: Users },
    { label: "Seguimientos pendientes", value: pendingTasks, icon: CalendarClock },
    { label: "Tareas vencidas", value: overdueTasks, icon: CalendarClock },
    { label: "Valor potencial", value: money(potentialValue), icon: CircleDollarSign },
    { label: "Valor ganado", value: money(wonValue), icon: CircleDollarSign },
    { label: "Tasa de conversion", value: `${conversion}%`, icon: TrendingUp },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Centro comercial Ken Code</h1>
        </div>
        <Link href="/admin/notificaciones" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-cyan/30 bg-kc-cyan/10 px-4 text-sm font-black text-kc-cyan">
          <Bell size={17} aria-hidden="true" />
          {unread} sin leer
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={statClass()}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-kc-muted">{card.label}</p>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-kc-cyan/10 text-kc-cyan">
                  <Icon size={18} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 font-display text-3xl font-black text-kc-text">{card.value}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="font-display text-2xl font-black text-kc-text">Proximos seguimientos</h2>
          <div className="mt-4 grid gap-3">
            {tasks.slice(0, 5).map((task) => (
              <Link key={task.id} href="/admin/tareas" className="rounded-xl border border-white/10 bg-kc-bg/50 p-4">
                <p className="font-bold text-kc-text">{task.title}</p>
                <p className="mt-1 text-sm text-kc-muted">{task.leadName || "Sin lead relacionado"} - {task.date || "Sin fecha"}</p>
              </Link>
            ))}
            {tasks.length === 0 ? <p className="text-sm text-kc-muted">No hay tareas creadas todavia.</p> : null}
          </div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="font-display text-2xl font-black text-kc-text">Notificaciones</h2>
          <div className="mt-4 grid gap-3">
            {notifications.slice(0, 5).map((notification) => (
              <Link key={notification.id} href="/admin/notificaciones" className="rounded-xl border border-white/10 bg-kc-bg/50 p-4">
                <p className="font-bold text-kc-text">{notification.title}</p>
                <p className="mt-1 text-sm leading-6 text-kc-muted">{notification.message}</p>
              </Link>
            ))}
            {notifications.length === 0 ? <p className="text-sm text-kc-muted">No hay notificaciones todavia.</p> : null}
          </div>
        </article>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-kc-text">Leads recientes</h2>
          <Link href="/admin/leads" className="text-sm font-black text-kc-cyan">Ver todos</Link>
        </div>
        <LeadList initialLeads={leads.slice(0, 6)} />
      </section>
    </div>
  );
}
