import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, CircleDollarSign, Clock3, FolderKanban, TrendingUp, Users, WalletCards } from "lucide-react";
import type { ActivityLog, AdminLead, AdminNotification, AdminTask } from "@/lib/admin/types";
import { activityHref, formatActivityMessage, mapActivityTone } from "@/lib/admin/activity";
import { leadStatusLabels, money, shortDate, timeAgo } from "./admin-labels";
import { todayInHonduras } from "@/lib/time";
import { AdminBarChart, AdminDonutMetric } from "./admin-chart";
import { KpiCard } from "./kpi-card";
import { LeadList } from "./lead-list";
import type { CommercialClient, CommercialProject } from "@/lib/commercial/types";
import { formatMinor } from "@/lib/billing/money";

type BillingSummary = { currency:string; dueToday:string; next7:string; overdue:string; outstanding:string; collectedMonth:string };
export function AdminDashboard({ leads, tasks, notifications, activity, canEditLeads, canCreateTasks, canViewTasks, canViewNotifications, canViewActivity, personalScope = false, clients = [], projects = [], billingSummary = [] }: { leads: AdminLead[]; tasks: AdminTask[]; notifications: AdminNotification[]; activity: ActivityLog[]; canEditLeads: boolean; canCreateTasks: boolean; canViewTasks: boolean; canViewNotifications: boolean; canViewActivity: boolean; personalScope?: boolean; clients?:CommercialClient[];projects?:CommercialProject[];billingSummary?:BillingSummary[] }) {
  const total = leads.length;
  const newLeads = leads.filter((lead) => lead.status === "new").length;
  const contacted = leads.filter((lead) => lead.status === "contacted").length;
  const conversation = leads.filter((lead) => lead.status === "conversation").length;
  const quoted = leads.filter((lead) => lead.status === "quoted").length;
  const won = leads.filter((lead) => lead.status === "won").length;
  const lost = leads.filter((lead) => lead.status === "lost").length;
  const pendingTasks = tasks.filter((task) => task.status !== "completed").length;
  const overdueTasks = tasks.filter((task) => task.status === "overdue" || (task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "completed")).length;
  const wonValue = leads.reduce((sum, lead) => sum + lead.wonValue, 0);
  const conversion = total ? Math.round((won / total) * 100) : 0;
  const unread = notifications.filter((notification) => !notification.read).length;
  const today = todayInHonduras();
  const todayTasks = tasks.filter((task) => task.date === today && task.status !== "completed").length;

  const activeClients=clients.filter(client=>client.status==="active").length;
  const activeProjects=projects.filter(project=>project.status==="active").length;
  const financialValue=(key:"outstanding"|"collectedMonth")=>billingSummary.length?billingSummary.map(item=>formatMinor(item[key],item.currency)).join(" · "):"Sin movimientos";
  const cards = [
    { label: "Clientes activos", value: activeClients, detail: `${clients.length} clientes registrados`, icon: Users, accent: "blue" as const },
    { label: "Proyectos en curso", value: activeProjects, detail: `${projects.length} proyectos registrados`, icon: FolderKanban, accent: "cyan" as const },
    { label: "Cobros pendientes", value: financialValue("outstanding"), detail: "Saldo total en USD", icon: CircleDollarSign, accent: "lime" as const },
    { label: "Cobrado este mes", value: financialValue("collectedMonth"), detail: "Dinero real recibido", icon: WalletCards, accent: "green" as const },
    { label: personalScope ? "Mis leads" : "Leads en cartera", value: total, detail: `${newLeads} nuevos · ${won} ganados`, icon: TrendingUp, accent: "blue" as const },
    ...(canViewTasks ? [{ label: "Tareas pendientes", value: pendingTasks, detail: `${todayTasks} hoy · ${overdueTasks} vencidas`, icon: CalendarClock, accent: overdueTasks ? "rose" as const : "slate" as const }] : []),
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
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Panel General</p>
          <h1 className="mt-1 font-display text-2xl font-black text-kc-text sm:text-3xl">{personalScope ? "Mi cartera comercial" : "Resumen comercial y operativo"}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-kc-muted">{personalScope ? "Indicadores calculados únicamente con registros asignados a tu cuenta." : "Clientes, proyectos, cobros y tareas reales de Ken Code en una vista compacta."}</p>
        </div>
        {canViewNotifications ? <Link href="/admin/notificaciones" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-cyan/30 bg-kc-cyan/10 px-4 text-sm font-black text-kc-cyan transition hover:border-kc-cyan/60 hover:bg-kc-cyan/15">
          <Bell size={17} aria-hidden="true" />
          {unread} sin leer
        </Link> : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => <KpiCard key={card.label} {...card} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.78fr]">
        <AdminBarChart title="Pipeline comercial" description="Distribución actual de leads por estado." items={pipeline} />
        <AdminDonutMetric title="Tasa de cierre" value={won} total={total} label={`${won} de ${total} leads convertidos`} />
      </section>

      {canViewTasks || canViewActivity ? <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        {canViewTasks ? <article className="kc-admin-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-black text-kc-text">Próximos seguimientos</h2>
            <Link href="/admin/tareas" className="inline-flex items-center gap-1 text-sm font-black text-kc-cyan">
              Ver agenda <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {tasks.slice(0, 5).map((task) => (
              <Link key={task.id} href="/admin/tareas" className="rounded-xl border border-white/10 bg-kc-bg/48 p-3 transition hover:border-kc-cyan/35 hover:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-kc-text">{task.title}</p>
                    <p className="mt-1 truncate text-sm text-kc-muted">{task.leadName || "Sin lead relacionado"}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-kc-muted">{shortDate(task.dueAt)}</span>
                </div>
              </Link>
            ))}
            {tasks.length === 0 ? <p className="rounded-xl border border-dashed border-white/12 p-4 text-sm text-kc-muted">No hay tareas creadas todavía.</p> : null}
          </div>
        </article> : null}
        {canViewActivity ? <article className="kc-admin-card p-4 sm:p-5">
          <h2 className="font-display text-xl font-black text-kc-text">Actividad reciente</h2>
          <div className="mt-4 grid gap-3">
            {recentActivity.map((item) => {
              const tone = mapActivityTone(item);
              const dot = tone === "danger" ? "bg-rose-300" : tone === "warning" ? "bg-kc-lime" : tone === "success" ? "bg-kc-turquoise" : "bg-kc-cyan";
              return (
              <Link key={item.id} href={activityHref(item)} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-white/10 bg-kc-bg/48 p-3 transition hover:border-kc-cyan/35 hover:bg-white/[0.04]">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dot} shadow-[0_0_18px_rgba(0,217,255,0.35)]`} />
                <span className="min-w-0">
                  <span className="block truncate font-bold text-kc-text">{item.title}</span>
                  <span className="mt-1 block line-clamp-2 text-sm leading-6 text-kc-muted">{formatActivityMessage(item)}</span>
                  <span className="mt-2 block text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">{timeAgo(item.createdAt)}</span>
                </span>
              </Link>
            )})}
            {recentActivity.length === 0 ? <p className="rounded-xl border border-dashed border-white/12 p-4 text-sm text-kc-muted">Aún no hay actividad reciente.</p> : null}
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
