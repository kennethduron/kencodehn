import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, CircleDollarSign, Clock3, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { ActivityLog, AdminLead, AdminNotification, AdminTask } from "@/lib/admin/types";
import { activityHref, mapActivityTone } from "@/lib/admin/activity";
import { leadStatusLabels, money, shortDate, timeAgo } from "./admin-labels";
import { todayInHonduras } from "@/lib/time";
import { AdminBarChart, AdminDonutMetric } from "./admin-chart";
import { KpiCard } from "./kpi-card";
import { LeadList } from "./lead-list";

export function AdminDashboard({ leads, tasks, notifications, activity, canEditLeads, canCreateTasks, canViewTasks, canViewNotifications, canViewActivity }: { leads: AdminLead[]; tasks: AdminTask[]; notifications: AdminNotification[]; activity: ActivityLog[]; canEditLeads: boolean; canCreateTasks: boolean; canViewTasks: boolean; canViewNotifications: boolean; canViewActivity: boolean }) {
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
  const potentialInitialRevenue = leads.reduce((sum, lead) => sum + (lead.initialProjectAmount || lead.estimatedValue), 0);
  const wonInitialRevenue = leads.filter((lead) => lead.status === "won").reduce((sum, lead) => sum + (lead.initialProjectAmount || lead.wonValue || lead.estimatedValue), 0);
  const potentialMonthlyRevenue = leads.reduce((sum, lead) => sum + lead.monthlyFee, 0);
  const activeMonthlyRevenue = leads.filter((lead) => lead.status === "won" || lead.paymentStatus === "active").reduce((sum, lead) => sum + lead.monthlyFee, 0);
  const leadsWithMonthly = leads.filter((lead) => lead.monthlyFee > 0).length;
  const wonWithMonthly = leads.filter((lead) => lead.monthlyFee > 0 && lead.status === "won").length;
  const conversion = total ? Math.round((won / total) * 100) : 0;
  const unread = notifications.filter((notification) => !notification.read).length;
  const today = todayInHonduras();
  const todayTasks = tasks.filter((task) => task.date === today && task.status !== "completed").length;

  const cards = [
    { label: "Total de leads", value: total, detail: `${newLeads} nuevos en pipeline`, icon: Users, accent: "cyan" as const },
    { label: "Leads ganados", value: won, detail: `${money(wonValue)} cerrados`, icon: TrendingUp, accent: "green" as const },
    { label: "Leads perdidos", value: lost, detail: "Oportunidades para revisar", icon: TrendingDown, accent: "rose" as const },
    ...(canViewTasks ? [{ label: "Tareas pendientes", value: pendingTasks, detail: `${todayTasks} para hoy`, icon: CalendarClock, accent: overdueTasks ? "rose" as const : "blue" as const }] : []),
    ...(canViewNotifications ? [{ label: "Sin leer", value: unread, detail: "Notificaciones internas", icon: Bell, accent: unread ? "rose" as const : "slate" as const }] : []),
    { label: "Valor potencial", value: money(potentialValue), detail: "Estimado del pipeline", icon: CircleDollarSign, accent: "lime" as const },
    { label: "Inicial potencial", value: money(potentialInitialRevenue), detail: "Monto inicial de proyectos", icon: CircleDollarSign, accent: "lime" as const },
    { label: "Inicial ganado", value: money(wonInitialRevenue), detail: "Proyectos cerrados", icon: TrendingUp, accent: "green" as const },
    { label: "Mensualidad potencial", value: `${money(potentialMonthlyRevenue)}/mes`, detail: `${leadsWithMonthly} leads con mensualidad`, icon: CircleDollarSign, accent: "blue" as const },
    { label: "Mensualidad activa", value: `${money(activeMonthlyRevenue)}/mes`, detail: `${wonWithMonthly} clientes ganados`, icon: TrendingUp, accent: "green" as const },
    { label: "Conversion", value: `${conversion}%`, detail: "Ganados sobre total", icon: TrendingUp, accent: "green" as const },
    ...(canViewTasks ? [{ label: "Tareas vencidas", value: overdueTasks, detail: overdueTasks ? "Requieren accion" : "Todo bajo control", icon: Clock3, accent: overdueTasks ? "rose" as const : "slate" as const }] : []),
  ];
  const pipeline = [
    { label: leadStatusLabels.new, value: newLeads, tone: "cyan" as const },
    { label: leadStatusLabels.contacted, value: contacted, tone: "blue" as const },
    { label: leadStatusLabels.conversation, value: conversation, tone: "green" as const },
    { label: leadStatusLabels.quoted, value: quoted, tone: "lime" as const },
    { label: leadStatusLabels.won, value: won, tone: "green" as const },
    { label: leadStatusLabels.lost, value: lost, tone: "rose" as const },
  ];
  const recentActivity = activity.slice(0, 6);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Centro de operaciones</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-kc-muted">Pipeline, tareas y alertas internas en una vista rapida para operar Ken Code con claridad.</p>
        </div>
        {canViewNotifications ? <Link href="/admin/notificaciones" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-cyan/30 bg-kc-cyan/10 px-4 text-sm font-black text-kc-cyan transition hover:border-kc-cyan/60 hover:bg-kc-cyan/15">
          <Bell size={17} aria-hidden="true" />
          {unread} sin leer
        </Link> : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <KpiCard key={card.label} {...card} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.78fr]">
        <AdminBarChart title="Pipeline comercial" description="Distribucion actual de leads por estado." items={pipeline} />
        <AdminDonutMetric title="Tasa de cierre" value={won} total={total} label={`${won} de ${total} leads convertidos`} />
      </section>

      {canViewTasks || canViewActivity ? <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        {canViewTasks ? <article className="kc-admin-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-black text-kc-text">Proximos seguimientos</h2>
            <Link href="/admin/tareas" className="inline-flex items-center gap-1 text-sm font-black text-kc-cyan">
              Ver agenda <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {tasks.slice(0, 5).map((task) => (
              <Link key={task.id} href="/admin/tareas" className="rounded-xl border border-white/10 bg-kc-bg/48 p-4 transition hover:border-kc-cyan/35 hover:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-kc-text">{task.title}</p>
                    <p className="mt-1 truncate text-sm text-kc-muted">{task.leadName || "Sin lead relacionado"}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-kc-muted">{shortDate(task.dueAt)}</span>
                </div>
              </Link>
            ))}
            {tasks.length === 0 ? <p className="rounded-xl border border-dashed border-white/12 p-5 text-sm text-kc-muted">No hay tareas creadas todavia.</p> : null}
          </div>
        </article> : null}
        {canViewActivity ? <article className="kc-admin-card p-5">
          <h2 className="font-display text-xl font-black text-kc-text">Actividad reciente</h2>
          <div className="mt-4 grid gap-3">
            {recentActivity.map((item) => {
              const tone = mapActivityTone(item);
              const dot = tone === "danger" ? "bg-rose-300" : tone === "warning" ? "bg-kc-lime" : tone === "success" ? "bg-kc-turquoise" : "bg-kc-cyan";
              return (
              <Link key={item.id} href={activityHref(item)} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-white/10 bg-kc-bg/48 p-4 transition hover:border-kc-cyan/35 hover:bg-white/[0.04]">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dot} shadow-[0_0_18px_rgba(0,217,255,0.35)]`} />
                <span className="min-w-0">
                  <span className="block truncate font-bold text-kc-text">{item.title}</span>
                  <span className="mt-1 block line-clamp-2 text-sm leading-6 text-kc-muted">{item.description}</span>
                  <span className="mt-2 block text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">{timeAgo(item.createdAt)}</span>
                </span>
              </Link>
            )})}
            {recentActivity.length === 0 ? <p className="rounded-xl border border-dashed border-white/12 p-5 text-sm text-kc-muted">Aun no hay actividad reciente.</p> : null}
          </div>
        </article> : null}
      </section> : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black text-kc-text">Leads recientes</h2>
          <Link href="/admin/leads" className="text-sm font-black text-kc-cyan">Ver todos</Link>
        </div>
        <LeadList initialLeads={leads.slice(0, 6)} canEdit={canEditLeads} canCreateTasks={canCreateTasks} />
      </section>
    </div>
  );
}
