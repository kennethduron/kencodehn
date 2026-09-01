"use client";

import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminMember } from "@/lib/admin/types";
import type {
  CommercialActivity,
  CommercialClient,
  CommercialProject,
  ProjectPaymentPlan,
  ProjectRecurringService,
  SellerAssignmentEvent,
} from "@/lib/commercial/types";
import type {
  BillingReceivable,
  ProjectBillingSummary,
} from "@/lib/billing/types";
import { ProjectBillingSection } from "./billing-detail-sections";
import {
  addMinor,
  formatMinor,
  formatSignedMinor,
  minorToDecimalInput,
  parseMoneyToMinor,
} from "@/lib/billing/money";
import { todayInHonduras } from "@/lib/time";

const projectStatuses = [
  ["draft", "Borrador"],
  ["planning", "Planificación"],
  ["active", "Activo"],
  ["on_hold", "En pausa"],
  ["completed", "Completado"],
  ["cancelled", "Cancelado"],
] as const;
const money = formatMinor;
const businessDateTimeFormatter = new Intl.DateTimeFormat("es-HN", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Tegucigalpa",
});
const formatBusinessDateTime = (value: string) =>
  businessDateTimeFormatter.format(new Date(value));

async function mutate(operation: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/commercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || "No se pudo completar la operación.");
  return body.result as Record<string, unknown>;
}

type DraftRow = {
  label: string;
  amount: string;
  dueDate: string;
  dueTime: string;
  notes: string;
};

export function ProjectDetail({
  project,
  client,
  plans,
  recurring,
  activity,
  assignments,
  billingSummary,
  billingReceivables,
  members,
  canEdit,
  canAssign,
  canEditPlans,
  canEditRecurring,
}: {
  project: CommercialProject;
  client: CommercialClient;
  plans: ProjectPaymentPlan[];
  recurring: ProjectRecurringService | null;
  activity: CommercialActivity[];
  assignments: SellerAssignmentEvent[];
  billingSummary: ProjectBillingSummary | null;
  billingReceivables: BillingReceivable[];
  members: AdminMember[];
  canEdit: boolean;
  canAssign: boolean;
  canEditPlans: boolean;
  canEditRecurring: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "overview" | "billing" | "plan" | "recurring" | "activity"
  >("overview");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const latestDraft = plans.find((plan) => plan.status === "draft");
  const [planId, setPlanId] = useState(latestDraft?.id || "");
  const [planName, setPlanName] = useState(
    latestDraft?.name || "Plan comercial",
  );
  const [installments, setInstallments] = useState<DraftRow[]>(
    latestDraft?.installments.map((item) => ({
      label: item.label,
      amount: minorToDecimalInput(item.amountMinor),
      dueDate: item.dueDate || "",
      dueTime: item.dueTime || "",
      notes: item.notes,
    })) || [
      {
        label: "Anticipo",
        amount: "0.00",
        dueDate: "",
        dueTime: "",
        notes: "",
      },
    ],
  );
  const plannedMinor = useMemo(() => {
    try {
      return addMinor(
        installments.map((item) => parseMoneyToMinor(item.amount)),
      );
    } catch {
      return BigInt(-1);
    }
  }, [installments]);
  const difference = BigInt(project.totalAmountMinor) - plannedMinor;

  async function updateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    try {
      await mutate("project_update", {
        id: project.id,
        updates: {
          name: String(data.get("name") || ""),
          description: String(data.get("description") || ""),
          status: String(data.get("status") || "planning"),
          totalAmountMinor: parseMoneyToMinor(
            String(data.get("totalAmount") || "0"),
          ).toString(),
          currency: "USD",
          soldAt: String(data.get("soldAt") || ""),
          effectiveDate: String(data.get("effectiveDate") || ""),
          startDate: String(data.get("startDate") || ""),
          targetEndDate: String(data.get("targetEndDate") || ""),
        },
      });
      setFeedback("Proyecto actualizado.");
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
      await mutate("project_assign", {
        id: project.id,
        assignedToUid: value,
        reason: "Actualización desde la ficha del proyecto",
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
  function changeInstallment(
    index: number,
    key: keyof DraftRow,
    value: string,
  ) {
    setInstallments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  async function savePlan() {
    setSaving(true);
    setFeedback("");
    try {
      const result = await mutate("payment_plan_save", {
        ...(planId ? { id: planId } : {}),
        projectId: project.id,
        name: planName,
        installments: installments.map((item) => ({
          label: item.label,
          amountMinor: parseMoneyToMinor(item.amount).toString(),
          currency: project.currency,
          dueDate: item.dueDate,
          dueTime: item.dueTime,
          notes: item.notes,
        })),
      });
      setPlanId(String(result.id));
      setFeedback("Borrador guardado. Aún no representa un cobro.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No se pudo guardar el plan.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function activatePlan() {
    if (!planId) return;
    setSaving(true);
    setFeedback("");
    try {
      await mutate("payment_plan_activate", { id: planId });
      setFeedback("Plan comercial activado.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "El total debe coincidir exactamente con el proyecto.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveRecurring(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    try {
      await mutate("recurring_service_save", {
        projectId: project.id,
        name: String(data.get("name") || ""),
        monthlyAmountMinor: parseMoneyToMinor(
          String(data.get("monthlyAmount") || "0"),
        ).toString(),
        currency: "USD",
        frequency: String(data.get("frequency") || "monthly"),
        startDate: String(data.get("startDate") || ""),
        billingDay: Number(data.get("billingDay") || 1),
        billingTime: String(data.get("billingTime") || "09:00"),
        timezone: "America/Tegucigalpa",
        status: String(data.get("status") || "draft"),
      });
      setFeedback("Servicio recurrente guardado.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <Link
          href="/admin/proyectos"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-kc-electric"
        >
          <ArrowLeft size={17} /> Volver a proyectos
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kc-cyan">
              Proyecto de{" "}
              <Link href={`/admin/clientes/${client.id}`} className="underline">
                {client.company || client.name}
              </Link>
            </p>
            <h1 className="mt-1 font-display text-3xl font-black text-kc-text sm:text-4xl">
              {project.name}
            </h1>
            <p className="mt-2 text-kc-muted">
              {money(project.totalAmountMinor, project.currency)} · importe
              contractual
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/cobros?projectId=${project.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-black text-blue-700"
            >
              <CircleDollarSign size={17} /> Ver cobros
            </Link>
            {canEditPlans ? (
              <Link
                href={`/admin/cobros?projectId=${project.id}&pay=1`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
              >
                <WalletCards size={17} /> Registrar pago
              </Link>
            ) : null}
            <Link
              href={`/admin/mail?compose=1&to=${encodeURIComponent(client.email)}&client=${client.id}&project=${project.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-black text-blue-700"
            >
              <Mail size={17} /> Enviar correo
            </Link>
            <span className="w-fit rounded-full border bg-blue-50 px-3 py-1.5 text-sm font-black text-kc-electric">
              {projectStatuses.find(([value]) => value === project.status)?.[1]}
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-flex min-w-max gap-2 rounded-2xl border bg-white p-2"
          role="tablist"
          aria-label="Secciones del proyecto"
        >
          {[
            ["overview", "Resumen"],
            ["billing", "Cobros"],
            ["plan", "Plan comercial"],
            ["recurring", "Servicio recurrente"],
            ["activity", "Actividad"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value as typeof tab)}
              className={`min-h-11 rounded-xl px-4 text-sm font-black ${tab === value ? "bg-kc-electric text-white" : "text-kc-muted hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {feedback ? (
        <p
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-kc-electric"
        >
          {feedback}
        </p>
      ) : null}

      {tab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <form
            onSubmit={updateProject}
            className="kc-admin-card grid gap-4 p-5 sm:grid-cols-2"
          >
            <h2 className="font-display text-2xl font-black text-kc-text sm:col-span-2">
              Información del proyecto
            </h2>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Nombre
              <input
                name="name"
                defaultValue={project.name}
                disabled={!canEdit}
                minLength={2}
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Estado
              <select
                name="status"
                defaultValue={project.status}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              >
                {projectStatuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Monto total
              <input
                name="totalAmount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={minorToDecimalInput(project.totalAmountMinor)}
                disabled={!canEdit}
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Moneda
              <input
                name="currency"
                pattern="[A-Z]{3}"
                maxLength={3}
                defaultValue={project.currency}
                disabled={!canEdit}
                required
                className="min-h-11 rounded-xl border px-3 uppercase"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Fecha efectiva
              <input
                name="effectiveDate"
                type="date"
                max={todayInHonduras()}
                defaultValue={project.effectiveDate}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Fecha de venta
              <input
                name="soldAt"
                type="date"
                defaultValue={project.soldAt || ""}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Inicio
              <input
                name="startDate"
                type="date"
                defaultValue={project.startDate || ""}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted">
              Fecha objetivo
              <input
                name="targetEndDate"
                type="date"
                defaultValue={project.targetEndDate || ""}
                disabled={!canEdit}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2">
              Descripción
              <textarea
                name="description"
                defaultValue={project.description}
                disabled={!canEdit}
                rows={5}
                className="rounded-xl border p-3"
              />
            </label>
            {canEdit ? (
              <button
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2"
              >
                <Save size={17} />
                {saving ? "Guardando…" : "Guardar proyecto"}
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
                  aria-label="Responsable del proyecto"
                  defaultValue={project.assignedToUid || ""}
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
                  {members.find(
                    (member) => member.uid === project.assignedToUid,
                  )?.name ||
                    members.find(
                      (member) => member.uid === project.assignedToUid,
                    )?.email ||
                    "Sin responsable"}
                </p>
              )}
            </div>
            <div className="kc-admin-card p-5">
              <h2 className="font-display text-xl font-black text-kc-text">
                Control
              </h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-kc-muted">Creado</dt>
                  <dd className="font-bold text-kc-text">
                    {formatBusinessDateTime(project.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-kc-muted">Reasignaciones</dt>
                  <dd className="font-bold text-kc-text">
                    {assignments.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-kc-muted">Planes históricos</dt>
                  <dd className="font-bold text-kc-text">{plans.length}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "billing" ? (
        <ProjectBillingSection
          summary={billingSummary}
          receivables={billingReceivables}
        />
      ) : null}

      {tab === "plan" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="kc-admin-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-kc-cyan">
                  Distribución contractual
                </p>
                <h2 className="mt-1 font-display text-2xl font-black text-kc-text">
                  Constructor de plan
                </h2>
                <p className="mt-1 text-sm text-kc-muted">
                  Un borrador puede estar incompleto. Solo se activa cuando suma
                  exactamente{" "}
                  {money(project.totalAmountMinor, project.currency)}.
                </p>
              </div>
              {canEditPlans ? (
                <button
                  type="button"
                  onClick={() =>
                    setInstallments((current) => [
                      ...current,
                      {
                        label: `Cuota ${current.length + 1}`,
                        amount: "0.00",
                        dueDate: "",
                        dueTime: "",
                        notes: "",
                      },
                    ])
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black text-kc-electric"
                >
                  <Plus size={17} /> Agregar cuota
                </button>
              ) : null}
            </div>
            <label className="mt-5 grid gap-2 text-sm font-bold text-kc-muted">
              Nombre del plan
              <input
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                disabled={!canEditPlans}
                maxLength={140}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <div className="mt-5 grid gap-4">
              {installments.map((item, index) => (
                <article
                  key={index}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-black text-kc-text">
                      Cuota {index + 1}
                    </h3>
                    {canEditPlans && installments.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setInstallments((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        className="grid h-11 w-11 place-items-center rounded-xl border text-rose-700"
                        aria-label={`Eliminar cuota ${index + 1}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="grid gap-2 text-sm font-bold text-kc-muted">
                      Concepto
                      <input
                        value={item.label}
                        onChange={(event) =>
                          changeInstallment(index, "label", event.target.value)
                        }
                        disabled={!canEditPlans}
                        className="min-h-11 rounded-xl border px-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-kc-muted">
                      Monto ({project.currency})
                      <input
                        value={item.amount}
                        onChange={(event) =>
                          changeInstallment(index, "amount", event.target.value)
                        }
                        disabled={!canEditPlans}
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        className="min-h-11 rounded-xl border px-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-kc-muted">
                      Fecha planificada
                      <input
                        value={item.dueDate}
                        onChange={(event) =>
                          changeInstallment(
                            index,
                            "dueDate",
                            event.target.value,
                          )
                        }
                        disabled={!canEditPlans}
                        type="date"
                        className="min-h-11 rounded-xl border px-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-kc-muted">
                      Hora opcional
                      <input
                        value={item.dueTime}
                        onChange={(event) =>
                          changeInstallment(
                            index,
                            "dueTime",
                            event.target.value,
                          )
                        }
                        disabled={!canEditPlans}
                        type="time"
                        className="min-h-11 rounded-xl border px-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-kc-muted sm:col-span-2 xl:col-span-4">
                      Notas
                      <input
                        value={item.notes}
                        onChange={(event) =>
                          changeInstallment(index, "notes", event.target.value)
                        }
                        disabled={!canEditPlans}
                        className="min-h-11 rounded-xl border px-3"
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
            {canEditPlans ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={savePlan}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-electric px-4 text-sm font-black text-kc-electric disabled:opacity-60"
                >
                  <Save size={17} /> Guardar borrador
                </button>
                <button
                  type="button"
                  disabled={saving || !planId || difference !== BigInt(0)}
                  onClick={activatePlan}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <CheckCircle2 size={17} /> Activar plan
                </button>
              </div>
            ) : null}
          </section>
          <aside className="grid content-start gap-4">
            <div className="kc-admin-card p-5">
              <h2 className="font-display text-xl font-black text-kc-text">
                Validación
              </h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-kc-muted">Proyecto</dt>
                  <dd className="font-black text-kc-text">
                    {money(project.totalAmountMinor, project.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-kc-muted">Distribuido</dt>
                  <dd className="font-black text-kc-text">
                    {plannedMinor >= BigInt(0)
                      ? money(plannedMinor, project.currency)
                      : "Monto inválido"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-kc-muted">Diferencia</dt>
                  <dd
                    className={`font-black ${difference === BigInt(0) ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {plannedMinor >= BigInt(0)
                      ? formatSignedMinor(difference, project.currency)
                      : "Monto inválido"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-kc-muted">
                Esto define un acuerdo comercial; no registra dinero recibido.
              </p>
            </div>
            <div className="kc-admin-card p-5">
              <h2 className="font-display text-xl font-black text-kc-text">
                Versiones
              </h2>
              <div className="mt-4 grid gap-3">
                {plans.length ? (
                  plans.map((plan) => (
                    <button
                      type="button"
                      key={plan.id}
                      disabled={plan.status !== "draft" || !canEditPlans}
                      onClick={() => {
                        setPlanId(plan.id);
                        setPlanName(plan.name);
                        setInstallments(
                          plan.installments.map((item) => ({
                            label: item.label,
                            amount: minorToDecimalInput(item.amountMinor),
                            dueDate: item.dueDate || "",
                            dueTime: item.dueTime || "",
                            notes: item.notes,
                          })),
                        );
                      }}
                      className="rounded-xl border p-3 text-left disabled:cursor-default"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-black text-kc-text">
                          v{plan.version} · {plan.name}
                        </span>
                        <span className="text-xs font-black uppercase text-kc-cyan">
                          {plan.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-kc-muted">
                        {money(plan.plannedTotalMinor, plan.currency)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-kc-muted">
                    Sin versiones todavía.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "recurring" ? (
        <form
          onSubmit={saveRecurring}
          className="kc-admin-card grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div className="sm:col-span-2 xl:col-span-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kc-cyan">
              Separado del proyecto
            </p>
            <h2 className="mt-1 font-display text-2xl font-black text-kc-text">
              Servicio recurrente
            </h2>
            <p className="mt-1 text-sm text-kc-muted">
              Al activarlo, el CRM genera Cobros desde la fecha de inicio y
              mantiene los próximos periodos según la frecuencia configurada.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Nombre
            <input
              name="name"
              defaultValue={recurring?.name || "Servicio recurrente"}
              disabled={!canEditRecurring}
              required
              minLength={2}
              className="min-h-11 rounded-xl border px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Monto mensual (USD)
            <input
              name="monthlyAmount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              defaultValue={
                recurring
                  ? minorToDecimalInput(recurring.monthlyAmountMinor)
                  : "0.00"
              }
              disabled={!canEditRecurring}
              required
              className="min-h-11 rounded-xl border px-3"
            />
          </label>
          <div className="grid gap-2 text-sm font-bold text-kc-muted">
            <span>Moneda</span>
            <span className="flex min-h-11 items-center rounded-xl border bg-slate-50 px-3 text-kc-text">
              USD
            </span>
          </div>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Frecuencia
            <select
              name="frequency"
              defaultValue={recurring?.frequency || "monthly"}
              disabled={!canEditRecurring}
              className="min-h-11 rounded-xl border px-3"
            >
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Inicio
            <input
              name="startDate"
              type="date"
              defaultValue={
                recurring?.startDate || todayInHonduras()
              }
              disabled={!canEditRecurring}
              required
              className="min-h-11 rounded-xl border px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Día de facturación (1–28)
            <input
              name="billingDay"
              type="number"
              min="1"
              max="28"
              defaultValue={recurring?.billingDay || 1}
              disabled={!canEditRecurring}
              required
              className="min-h-11 rounded-xl border px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Hora
            <input
              name="billingTime"
              type="time"
              defaultValue={recurring?.billingTime || "09:00"}
              disabled={!canEditRecurring}
              required
              className="min-h-11 rounded-xl border px-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-kc-muted">
            Estado
            <select
              name="status"
              defaultValue={recurring?.status || "draft"}
              disabled={!canEditRecurring}
              className="min-h-11 rounded-xl border px-3"
            >
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="paused">En pausa</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-kc-muted">
            <CalendarClock className="mb-2 text-kc-cyan" size={19} />
            Zona horaria: America/Tegucigalpa
          </div>
          {canEditRecurring ? (
            <button
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2 xl:col-span-1"
            >
              <RefreshCw size={17} />
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          ) : null}
        </form>
      ) : null}

      {tab === "activity" ? (
        <section className="grid gap-3">
          {activity.length ? (
            activity.map((event) => (
              <article
                key={event.id}
                className="kc-admin-card grid grid-cols-[auto_1fr] gap-4 p-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-kc-electric">
                  <Activity size={18} />
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
            ))
          ) : (
            <div className="kc-admin-card grid min-h-64 place-items-center p-8 text-center">
              <div>
                <CircleDollarSign className="mx-auto text-kc-cyan" size={32} />
                <h2 className="mt-4 font-display text-2xl font-black text-kc-text">
                  Sin actividad
                </h2>
                <p className="mt-2 text-sm text-kc-muted">
                  Los cambios comerciales con actor humano aparecerán aquí.
                </p>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
