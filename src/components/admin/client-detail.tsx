"use client";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FolderKanban,
  History,
  Mail,
  ReceiptText,
  Save,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminMember } from "@/lib/admin/types";
import type {
  CommercialActivity,
  CommercialClient,
  CommercialProject,
  SellerAssignmentEvent,
} from "@/lib/commercial/types";
import type { ClientFinancialOverview } from "@/lib/commercial/data";
import type { BillingPayment, BillingReceivable } from "@/lib/billing/types";
import {
  ClientBillingSection,
  ClientBillingSettings,
  ClientPaymentsSection,
} from "./billing-detail-sections";
import { formatMinor } from "@/lib/billing/money";
import { todayInHonduras } from "@/lib/time";

const tabs = [
  ["overview", "Resumen"],
  ["projects", "Proyectos"],
  ["billing", "Facturación"],
  ["payments", "Pagos"],
  ["tasks", "Tareas"],
  ["communications", "Comunicaciones"],
  ["activity", "Actividad"],
] as const;

const businessDateTimeFormatter = new Intl.DateTimeFormat("es-HN", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Tegucigalpa",
});

function formatBusinessDateTime(value: string) {
  return businessDateTimeFormatter.format(new Date(value));
}

async function mutate(operation: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || "No se pudo completar la operación.");
  return body.result;
}

function EmptyFuture({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CreditCard;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="kc-admin-card grid min-h-64 place-items-center p-8 text-center">
      <div>
        <Icon className="mx-auto text-kc-cyan" size={32} />
        <h2 className="mt-4 font-display text-2xl font-black text-kc-text">
          {title}
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-kc-muted">
          {children}
        </p>
      </div>
    </div>
  );
}

export function ClientDetail({
  client,
  projects,
  tasks,
  activity,
  assignments,
  billingReceivables,
  billingPayments,
  financialOverview,
  members,
  canEdit,
  canAssign,
  canManageBilling,
  canRegisterHistory,
}: {
  client: CommercialClient;
  projects: CommercialProject[];
  tasks: Record<string, any>[];
  activity: CommercialActivity[];
  assignments: SellerAssignmentEvent[];
  billingReceivables: BillingReceivable[];
  billingPayments: BillingPayment[];
  financialOverview: ClientFinancialOverview;
  members: AdminMember[];
  canEdit: boolean;
  canAssign: boolean;
  canManageBilling: boolean;
  canRegisterHistory: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("overview");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    try {
      await mutate("client_update", {
        id: client.id,
        updates: {
          name: String(data.get("name") || ""),
          company: String(data.get("company") || ""),
          email: String(data.get("email") || ""),
          phone: String(data.get("phone") || ""),
          clientSince: String(data.get("clientSince") || ""),
          status: String(data.get("status") || "active"),
          notes: String(data.get("notes") || ""),
        },
      });
      setFeedback("Cliente actualizado.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No se pudo actualizar.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function assign(value: string) {
    setSaving(true);
    setFeedback("");
    try {
      await mutate("client_assign", {
        id: client.id,
        assignedToUid: value,
        reason: "Actualización desde la ficha del cliente",
      });
      setFeedback("Responsable actualizado.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No se pudo reasignar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <Link
          href="/admin/clientes"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-kc-electric"
        >
          <ArrowLeft size={17} /> Volver a clientes
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kc-cyan">
              Cliente
            </p>
            <h1 className="mt-1 font-display text-3xl font-black text-kc-text sm:text-4xl">
              {client.name}
            </h1>
            <p className="mt-2 text-kc-muted">
              {client.company || "Cliente particular"} · relación efectiva desde{" "}
              {client.clientSince}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`w-fit rounded-full border px-3 py-1.5 text-sm font-black ${client.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              {client.status === "active" ? "Activo" : "Inactivo"}
            </span>
            {canRegisterHistory ? (
              <Link
                href={`/admin/clientes/${client.id}/historial`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                <History size={17} /> Registrar información histórica
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-flex min-w-max gap-2 rounded-2xl border bg-white p-2"
          role="tablist"
          aria-label="Secciones del cliente"
        >
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-11 rounded-xl px-4 text-sm font-black ${tab === value ? "bg-kc-electric text-white" : "text-kc-muted hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
          aria-label="Resumen financiero del cliente"
        >
          {[
            ["Proyectos originales", financialOverview.originalProjectsMinor],
            ["Ventas adicionales", financialOverview.additionalSalesMinor],
            ["Total histórico vendido", financialOverview.lifetimeSoldMinor],
            ["Total cobrado", financialOverview.collectedMinor],
            ["Saldo pendiente", financialOverview.outstandingMinor],
            ["Mensualidad actual", financialOverview.monthlyCommitmentMinor],
          ].map(([label, value]) => (
            <article key={label} className="kc-admin-card p-4">
              <WalletCards size={18} className="text-blue-700" />
              <p className="mt-3 text-xs font-bold text-kc-muted">{label}</p>
              <p className="mt-1 text-lg font-black">
                {formatMinor(value, "USD")}
              </p>
            </article>
          ))}
          <article className="kc-admin-card p-4 sm:col-span-2 xl:col-span-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black">Compromiso mensual</h2>
                <p className="mt-1 text-sm text-kc-muted">
                  Servicio base y módulos permanecen separados internamente.
                </p>
              </div>
              <dl className="grid min-w-64 gap-2 text-sm">
                <div className="flex justify-between gap-6">
                  <dt>Servicio base</dt>
                  <dd className="font-black">
                    {formatMinor(financialOverview.baseMonthlyMinor, "USD")}
                  </dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt>Módulos adicionales</dt>
                  <dd className="font-black">
                    {formatMinor(financialOverview.addOnMonthlyMinor, "USD")}
                  </dd>
                </div>
                <div className="flex justify-between gap-6 border-t pt-2">
                  <dt className="font-black">Total mensual</dt>
                  <dd className="font-black text-blue-700">
                    {formatMinor(
                      financialOverview.monthlyCommitmentMinor,
                      "USD",
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </article>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-6">
            <Link
              href={`/admin/cobros?clientId=${client.id}`}
              className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-black text-blue-700"
            >
              Ver cobros
            </Link>
            <Link
              href={`/admin/cobros?clientId=${client.id}&pay=1`}
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
            >
              Registrar pago
            </Link>
          </div>
        </section>
      ) : null}

      {tab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <form
            onSubmit={update}
            className="kc-admin-card grid gap-4 p-5 sm:grid-cols-2"
          >
            <h2 className="font-display text-2xl font-black text-kc-text sm:col-span-2">
              Información comercial
            </h2>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Nombre
              <input
                name="name"
                defaultValue={client.name}
                disabled={!canEdit}
                minLength={2}
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Empresa
              <input
                name="company"
                defaultValue={client.company}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Correo
              <input
                name="email"
                type="email"
                defaultValue={client.email}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Teléfono
              <input
                name="phone"
                defaultValue={client.phone}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Cliente desde
              <input
                name="clientSince"
                type="date"
                max={todayInHonduras()}
                defaultValue={client.clientSince}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Estado
              <select
                name="status"
                defaultValue={client.status}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2">
              Notas
              <textarea
                name="notes"
                defaultValue={client.notes}
                disabled={!canEdit}
                rows={5}
                className="rounded-xl border p-3"
              />
            </label>
            {feedback ? (
              <p
                role="status"
                className="text-sm font-bold text-kc-electric sm:col-span-2"
              >
                {feedback}
              </p>
            ) : null}
            {canEdit ? (
              <button
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2"
              >
                <Save size={17} /> {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            ) : null}
          </form>
          <aside className="grid content-start gap-4">
            <div className="kc-admin-card p-5">
              <h2 className="flex items-center gap-2 font-display text-xl font-black text-kc-text">
                <UserRoundCheck size={19} /> Responsable
              </h2>
              {canAssign ? (
                <select
                  aria-label="Responsable comercial"
                  defaultValue={client.assignedToUid || ""}
                  disabled={saving}
                  onChange={(event) => assign(event.target.value)}
                  className="mt-4 min-h-11 w-full rounded-xl border px-3"
                >
                  <option value="">Sin responsable</option>
                  {members.map((member) => (
                    <option key={member.uid} value={member.uid}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-3 text-sm text-kc-muted">
                  {members.find((member) => member.uid === client.assignedToUid)
                    ?.name ||
                    members.find(
                      (member) => member.uid === client.assignedToUid,
                    )?.email ||
                    "Sin responsable"}
                </p>
              )}
            </div>
            <div className="kc-admin-card p-5">
              <h2 className="font-display text-xl font-black text-kc-text">
                Trazabilidad
              </h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-kc-muted">Creado en sistema</dt>
                  <dd className="font-bold text-kc-text">
                    {formatBusinessDateTime(client.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-kc-muted">Origen</dt>
                  <dd className="font-bold text-kc-text">
                    {client.originLeadId ? (
                      <Link
                        href={`/admin/leads/${client.originLeadId}`}
                        className="text-kc-electric hover:underline"
                      >
                        Lead convertido
                      </Link>
                    ) : (
                      "Alta manual"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-kc-muted">Reasignaciones</dt>
                  <dd className="font-bold text-kc-text">
                    {assignments.length}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "projects" ? (
        projects.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/admin/proyectos/${project.id}`}
                className="kc-admin-card p-5"
              >
                <FolderKanban className="text-kc-cyan" size={24} />
                <h2 className="mt-4 font-display text-xl font-black text-kc-text">
                  {project.name}
                </h2>
                <p className="mt-2 text-sm text-kc-muted">
                  {project.status} ·{" "}
                  {formatMinor(project.totalAmountMinor, project.currency)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyFuture icon={FolderKanban} title="Sin proyectos">
            Cree el primer proyecto desde el módulo Proyectos y asócielo a este
            cliente.
          </EmptyFuture>
        )
      ) : null}
      {tab === "billing" ? (
        <div className="grid gap-5">
          <ClientBillingSettings client={client} canManage={canManageBilling} />
          <ClientBillingSection receivables={billingReceivables} />
        </div>
      ) : null}
      {tab === "payments" ? (
        <ClientPaymentsSection payments={billingPayments} />
      ) : null}
      {tab === "tasks" ? (
        tasks.length ? (
          <div className="grid gap-3">
            {tasks.map((task) => (
              <article key={task.id} className="kc-admin-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardList size={18} className="text-kc-cyan" />
                  <h2 className="font-black text-kc-text">{task.title}</h2>
                  <span className="rounded-full border px-2 py-1 text-xs font-bold text-kc-muted">
                    {task.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-kc-muted">
                  {task.due_at
                    ? formatBusinessDateTime(task.due_at)
                    : "Sin fecha"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyFuture icon={CalendarDays} title="Sin tareas del cliente">
            Las tareas comerciales asociadas al cliente aparecerán aquí.
          </EmptyFuture>
        )
      ) : null}
      {tab === "communications" ? (
        <div className="kc-admin-card grid min-h-64 place-items-center p-8 text-center">
          <div>
            <Mail className="mx-auto text-blue-700" size={32} />
            <h2 className="mt-4 font-display text-2xl font-black text-kc-text">
              Comunicaciones del cliente
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-kc-muted">
              Redacte desde una identidad corporativa. La conversación quedará
              vinculada a esta ficha.
            </p>
            {client.email ? (
              <Link
                href={`/admin/mail?compose=1&to=${encodeURIComponent(client.email)}&client=${client.id}`}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                <Mail size={17} /> Redactar correo
              </Link>
            ) : (
              <p className="mt-4 text-sm font-bold text-amber-700">
                Agregue un correo al cliente para iniciar una conversación.
              </p>
            )}
            <Link
              href={`/admin/mail?q=${encodeURIComponent(client.email || client.name)}`}
              className="mt-3 block text-sm font-bold text-blue-700"
            >
              Buscar conversaciones
            </Link>
          </div>
        </div>
      ) : null}
      {tab === "activity" ? (
        activity.length ? (
          <div className="grid gap-3">
            {activity.map((event) => (
              <article
                key={event.id}
                className="kc-admin-card grid grid-cols-[auto_1fr] gap-4 p-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-kc-electric">
                  <CheckCircle2 size={18} />
                </span>
                <div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                    <h2 className="font-black text-kc-text">{event.title}</h2>
                    <time className="text-xs font-bold text-kc-muted">
                      {formatBusinessDateTime(event.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-kc-muted">
                    {event.description}
                  </p>
                  <p className="mt-2 text-xs font-bold text-kc-muted">
                    Actor: {event.actorEmail}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyFuture icon={Activity} title="Sin actividad">
            Los eventos humanos del cliente aparecerán en esta línea de tiempo.
          </EmptyFuture>
        )
      ) : null}
    </div>
  );
}
