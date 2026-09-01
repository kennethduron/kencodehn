"use client";

import {
  ArrowLeft,
  CheckCircle2,
  History,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ProjectAddOn } from "@/lib/add-ons/types";
import { formatMinor, parseMoneyToMinor } from "@/lib/billing/money";
import type { BillingReceivable } from "@/lib/billing/types";
import type {
  CommercialClient,
  CommercialProject,
} from "@/lib/commercial/types";
import type { HistoricalImportSession } from "@/lib/historical-import/data";
import { buildRecurringPreview } from "@/lib/historical-import/recurring-preview";
import { similarHistoricalModules } from "@/lib/historical-import/module-matching";
import { BillingPanel } from "./billing-panel";

type Installment = { label: string; amount: string; dueDate: string };
const steps = [
  "Cliente",
  "Proyecto original",
  "Pagos del proyecto",
  "Servicio mensual",
  "Mensualidades anteriores",
  "Módulos adicionales",
  "Pagos de módulos",
  "Revisión final",
];

async function post(
  url: string,
  operation: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || "No se pudo completar la operación.");
  return body.result as Record<string, unknown>;
}

export function HistoricalImportWizard({
  client,
  projects,
  addOns,
  receivables,
  session,
  today,
}: {
  client: CommercialClient;
  projects: CommercialProject[];
  addOns: ProjectAddOn[];
  receivables: BillingReceivable[];
  session: HistoricalImportSession | null;
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(session ? 1 : 0),
    [activeSession, setActiveSession] = useState(session),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [selectedProject, setSelectedProject] = useState(projects[0]?.id || "");
  const [projectAmount, setProjectAmount] = useState("0.00");
  const [projectRows, setProjectRows] = useState<Installment[]>([
    { label: "Anticipo", amount: "0.00", dueDate: "" },
    { label: "Pago final", amount: "0.00", dueDate: "" },
  ]);
  const [moduleRows, setModuleRows] = useState<Installment[]>([
    { label: "Pago único", amount: "0.00", dueDate: "" },
  ]);
  const [recurring, setRecurring] = useState({
    name: "Servicio mensual",
    amount: "119.00",
    startDate: "",
    billingDay: 1,
    billingTime: "09:00",
    frequency: "monthly" as const,
  });
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [moduleChoice, setModuleChoice] = useState<"undecided" | "existing" | "new">("undecided");
  const [existingModuleId, setExistingModuleId] = useState("");
  const project = projects.find((item) => item.id === selectedProject);
  const projectReceivables = receivables.filter(
    (item) =>
      item.projectId === selectedProject &&
      item.originType === "project_installment",
  );
  const recurringReceivables = receivables.filter(
    (item) =>
      item.projectId === selectedProject &&
      item.originType === "recurring_service",
  );
  const moduleReceivables = receivables.filter(
    (item) =>
      item.originType === "add_on_installment" ||
      item.originType === "add_on_recurring",
  );
  const recurringPaidMinor = recurringReceivables
    .reduce((total, item) => total + BigInt(item.amountPaidMinor), BigInt(0))
    .toString();
  const recurringHistoricalPendingMinor = recurringReceivables
    .filter(
      (item) =>
        item.dueDate < today &&
        (item.paymentState === "open" ||
          item.paymentState === "partially_paid"),
    )
    .reduce((total, item) => total + BigInt(item.balanceMinor), BigInt(0))
    .toString();
  const nextRecurringReceivable = recurringReceivables
    .filter(
      (item) =>
        item.dueDate >= today &&
        (item.paymentState === "open" ||
          item.paymentState === "partially_paid"),
    )
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  const preview = useMemo(() => {
    try {
      return recurring.startDate
        ? buildRecurringPreview({
            startDate: recurring.startDate,
            billingDay: recurring.billingDay,
            frequency: recurring.frequency,
            amountMinor: parseMoneyToMinor(recurring.amount).toString(),
            today,
          })
        : null;
    } catch {
      return null;
    }
  }, [recurring, today]);
  const similarModules = useMemo(
    () => similarHistoricalModules(addOns, selectedProject, moduleName),
    [addOns, moduleName, selectedProject],
  );
  const reusableModules = similarModules.filter(
    (item) => !item.sale && !["approved", "rejected", "cancelled"].includes(item.commercialStatus),
  );
  async function run(work: () => Promise<void>) {
    setSaving(true);
    setMessage("");
    try {
      await work();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setSaving(false);
    }
  }
  function updateRow(
    setter: React.Dispatch<React.SetStateAction<Installment[]>>,
    index: number,
    key: keyof Installment,
    value: string,
  ) {
    setter((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  }
  async function start() {
    await run(async () => {
      const result = await post("/api/admin/historical-import", "start", {
        clientId: client.id,
      });
      setActiveSession({
        id: String(result.id),
        clientId: client.id,
        status: "active",
        remindersPaused: true,
        remindersReenabled: false,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
      setStep(1);
      setMessage(
        "Registro histórico iniciado. Los recordatorios permanecen pausados.",
      );
    });
  }
  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(async () => {
      const totalMinor = parseMoneyToMinor(
        String(data.get("amount")),
      ).toString();
      const distributed = projectRows.reduce(
        (sum, row) => sum + parseMoneyToMinor(row.amount),
        BigInt(0),
      );
      if (distributed !== BigInt(totalMinor))
        throw new Error(
          "El total distribuido debe coincidir exactamente con el valor del proyecto.",
        );
      const created = await post("/api/admin/commercial", "project_create", {
        clientId: client.id,
        name: String(data.get("name")),
        description: String(data.get("description") || ""),
        status: String(data.get("status")),
        totalAmountMinor: totalMinor,
        currency: "USD",
        soldAt: String(data.get("soldAt")),
        effectiveDate: String(data.get("effectiveDate")),
        startDate: String(data.get("startDate") || ""),
        targetEndDate: "",
      });
      const id = String(created.id);
      const plan = await post("/api/admin/commercial", "payment_plan_save", {
        projectId: id,
        name: "Plan histórico",
        installments: projectRows.map((row, index) => ({
          label: row.label,
          amountMinor: parseMoneyToMinor(row.amount).toString(),
          currency: "USD",
          dueDate: row.dueDate,
          dueTime: "09:00",
          notes: "Registrado desde información histórica",
        })),
      });
      await post("/api/admin/commercial", "payment_plan_activate", {
        id: String(plan.id),
      });
      setSelectedProject(id);
      setStep(2);
      setMessage("Proyecto, plan y Cobros históricos registrados.");
    });
  }
  async function saveRecurring(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    if (preview?.periods.some((item) => item.historical) && !previewConfirmed) {
      setMessage("Revise y confirme la vista previa de periodos históricos.");
      return;
    }
    await run(async () => {
      await post("/api/admin/commercial", "recurring_service_save", {
        projectId: selectedProject,
        name: recurring.name,
        monthlyAmountMinor: parseMoneyToMinor(recurring.amount).toString(),
        currency: "USD",
        frequency: recurring.frequency,
        startDate: recurring.startDate,
        billingDay: recurring.billingDay,
        billingTime: recurring.billingTime,
        timezone: "America/Tegucigalpa",
        status: "active",
      });
      setStep(4);
      setMessage("Servicio mensual activado con sus Cobros separados.");
    });
  }
  async function createModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession || !selectedProject) return;
    const data = new FormData(event.currentTarget);
    await run(async () => {
      if (similarModules.length && moduleChoice === "undecided") {
        throw new Error("Revise el módulo similar y elija usarlo, crear otro o cancelar.");
      }
      if (moduleChoice === "existing" && !reusableModules.some((item) => item.id === existingModuleId)) {
        throw new Error("Seleccione un módulo existente que todavía no tenga una venta registrada.");
      }
      const amountMinor = parseMoneyToMinor(
        String(data.get("amount")),
      ).toString();
      const distributed = moduleRows.reduce(
        (sum, row) => sum + parseMoneyToMinor(row.amount),
        BigInt(0),
      );
      if (distributed !== BigInt(amountMinor))
        throw new Error(
          "Las cuotas del módulo deben sumar exactamente el precio de venta.",
        );
      await post("/api/admin/historical-import", "historical_add_on_create", {
        sessionId: activeSession.id,
        clientId: client.id,
        projectId: selectedProject,
        existingAddOnId: moduleChoice === "existing" ? existingModuleId : undefined,
        name: String(data.get("name")),
        description: String(data.get("description")),
        requestDate: String(data.get("requestDate")),
        effectiveDate: String(data.get("effectiveDate")),
        amountMinor,
        currency: "USD",
        requestedByClient: true,
        paymentTerms: String(data.get("paymentTerms") || "Acuerdo histórico"),
        workStatus: String(data.get("workStatus")),
        actualDeliveryDate: String(data.get("actualDeliveryDate") || ""),
        deliveryNotes: String(data.get("deliveryNotes") || ""),
        estimatedDelivery: "",
        monthlyAddOnMinor: parseMoneyToMinor(
          String(data.get("monthly") || "0"),
        ).toString(),
        monthlyStartDate: String(data.get("monthlyStartDate") || ""),
        monthlyBillingDay: Number(data.get("monthlyBillingDay") || 1),
        monthlyBillingTime: "09:00",
        installments: moduleRows.map((row, index) => ({
          sequence: index + 1,
          label: row.label,
          amountMinor: parseMoneyToMinor(row.amount).toString(),
          currency: "USD",
          dueDate: row.dueDate,
          dueTime: "09:00",
          notes: "Registrado desde información histórica",
        })),
      });
      setStep(6);
      setMessage(
        "Venta histórica del módulo y sus Cobros registrados sin enviar correo.",
      );
    });
  }
  async function complete(enableReminders: boolean) {
    if (!activeSession) return;
    await run(async () => {
      const result = await post("/api/admin/historical-import", "complete", {
        sessionId: activeSession.id,
        enableReminders,
      });
      setMessage(
        `Registro histórico finalizado. Saldo pendiente: ${formatMinor(String(result.pendingMinor || "0"), "USD")}. Recordatorios ${enableReminders ? "activados" : "pausados"}.`,
      );
      setActiveSession(null);
    });
  }
  const projectTotal = projectRows.reduce((sum, row) => {
    try {
      return sum + parseMoneyToMinor(row.amount);
    } catch {
      return sum;
    }
  }, BigInt(0));
  const moduleTotal = moduleRows.reduce((sum, row) => {
    try {
      return sum + parseMoneyToMinor(row.amount);
    } catch {
      return sum;
    }
  }, BigInt(0));
  return (
    <div className="grid gap-5">
      <div>
        <Link
          href={`/admin/clientes/${client.id}`}
          className="inline-flex min-h-11 items-center gap-2 font-black text-blue-700"
        >
          <ArrowLeft size={17} /> Volver al cliente
        </Link>
        <h1 className="mt-2 font-display text-3xl font-black">
          Registrar información histórica
        </h1>
        <p className="mt-2 max-w-3xl text-kc-muted">
          Cargue ventas y pagos anteriores sin cambiar sus fechas reales ni
          duplicar el motor financiero.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <p className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} />
          <span>
            <strong>
              Los recordatorios permanecerán pausados mientras registra
              información histórica.
            </strong>
            <br />
            No se enviarán correos, push ni recordatorios por estas obligaciones
            durante el proceso.
          </span>
        </p>
      </div>
      <nav
        aria-label="Pasos del registro histórico"
        className="kc-scroll-tabs overflow-x-auto"
      >
        <ol className="inline-flex min-w-max gap-2">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                disabled={!activeSession && index > 0}
                onClick={() => setStep(index)}
                className={`min-h-11 rounded-xl border px-3 text-sm font-black ${step === index ? "bg-blue-700 text-white" : "bg-white text-slate-700"}`}
              >
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {message ? (
        <p
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 font-bold text-blue-900"
        >
          {message}
        </p>
      ) : null}
      {step === 0 ? (
        <section className="kc-admin-card p-5">
          <History size={28} className="text-blue-700" />
          <h2 className="mt-3 text-2xl font-black">
            {client.company || client.name}
          </h2>
          <p className="mt-2 text-kc-muted">
            Cliente desde: {client.clientSince}. La fecha en que se creó el
            registro del CRM permanece intacta.
          </p>
          {activeSession ? (
            <button
              onClick={() => setStep(1)}
              className="mt-5 min-h-11 rounded-xl bg-blue-700 px-5 font-black text-white"
            >
              Continuar registro
            </button>
          ) : (
            <button
              onClick={start}
              disabled={saving}
              className="mt-5 min-h-11 rounded-xl bg-blue-700 px-5 font-black text-white"
            >
              Comenzar y pausar recordatorios
            </button>
          )}
        </section>
      ) : null}
      {step === 1 ? (
        <form onSubmit={createProject} className="kc-admin-card grid gap-4 p-5">
          <h2 className="text-2xl font-black">
            Proyecto original y plan histórico
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Nombre
              <input
                name="name"
                value={moduleName}
                onChange={(event) => {
                  setModuleName(event.target.value);
                  setModuleChoice("undecided");
                  setExistingModuleId("");
                }}
                required
                minLength={2}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            {similarModules.length ? (
              <fieldset className="grid gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:col-span-2">
                <legend className="px-1 font-black text-amber-950">Ya existe un módulo con un nombre similar.</legend>
                <p className="text-sm text-amber-950">Revise los registros antes de crear otro. No se combinará ni cambiará ningún módulo automáticamente.</p>
                {similarModules.map((item) => {
                  const reusable = reusableModules.some((candidate) => candidate.id === item.id);
                  return (
                    <label key={item.id} className={`flex min-h-12 items-start gap-3 rounded-xl border bg-white p-3 ${reusable ? "cursor-pointer" : "opacity-75"}`}>
                      <input
                        type="radio"
                        name="historicalModuleChoice"
                        value={item.id}
                        disabled={!reusable}
                        checked={moduleChoice === "existing" && existingModuleId === item.id}
                        onChange={() => { setModuleChoice("existing"); setExistingModuleId(item.id); }}
                        className="mt-1 h-5 w-5"
                      />
                      <span><strong>Usar existente: {item.name}</strong><br /><span className="text-sm text-kc-muted">{reusable ? "Se completará este registro con la venta histórica." : "Ya tiene una venta o un estado definitivo; se conservará sin cambios."}</span></span>
                    </label>
                  );
                })}
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-white p-3">
                  <input type="radio" name="historicalModuleChoice" value="new" checked={moduleChoice === "new"} onChange={() => { setModuleChoice("new"); setExistingModuleId(""); }} className="h-5 w-5" />
                  <strong>Crear de todas formas</strong>
                </label>
                <button type="button" onClick={() => { setModuleName(""); setModuleChoice("undecided"); setExistingModuleId(""); }} className="min-h-11 rounded-xl border bg-white px-4 font-black">Cancelar</button>
              </fieldset>
            ) : null}
            <label className="grid gap-2 text-sm font-bold">
              Valor total (USD)
              <input
                name="amount"
                value={projectAmount}
                onChange={(event) => setProjectAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Fecha real de venta
              <input
                name="soldAt"
                type="date"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Fecha efectiva
              <input
                name="effectiveDate"
                type="date"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Inicio
              <input
                name="startDate"
                type="date"
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Estado operativo
              <select
                name="status"
                defaultValue="active"
                className="min-h-11 rounded-xl border px-3"
              >
                <option value="planning">Planificación</option>
                <option value="active">Activo</option>
                <option value="completed">Completado</option>
                <option value="on_hold">En pausa</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2">
              Descripción
              <textarea
                name="description"
                rows={3}
                className="rounded-xl border p-3"
              />
            </label>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Cuotas reales</h3>
              <button
                type="button"
                onClick={() =>
                  setProjectRows((current) => [
                    ...current,
                    {
                      label: `Cuota ${current.length + 1}`,
                      amount: "0.00",
                      dueDate: "",
                    },
                  ])
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 font-black"
              >
                <Plus size={16} /> Agregar cuota
              </button>
            </div>
            {projectRows.map((row, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[1fr_10rem_11rem_3rem]"
              >
                <input
                  aria-label={`Concepto cuota ${index + 1}`}
                  value={row.label}
                  onChange={(event) =>
                    updateRow(
                      setProjectRows,
                      index,
                      "label",
                      event.target.value,
                    )
                  }
                  className="min-h-11 rounded-xl border px-3"
                />
                <input
                  aria-label={`Monto cuota ${index + 1}`}
                  value={row.amount}
                  onChange={(event) =>
                    updateRow(
                      setProjectRows,
                      index,
                      "amount",
                      event.target.value,
                    )
                  }
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="min-h-11 rounded-xl border px-3"
                />
                <input
                  aria-label={`Fecha cuota ${index + 1}`}
                  value={row.dueDate}
                  onChange={(event) =>
                    updateRow(
                      setProjectRows,
                      index,
                      "dueDate",
                      event.target.value,
                    )
                  }
                  type="date"
                  required
                  className="min-h-11 rounded-xl border px-3"
                />
                <button
                  type="button"
                  aria-label={`Eliminar cuota ${index + 1}`}
                  disabled={projectRows.length === 1}
                  onClick={() =>
                    setProjectRows((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                  className="grid h-11 w-11 place-items-center rounded-xl border text-rose-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="grid gap-2 rounded-xl bg-blue-50 p-4 sm:grid-cols-3">
            <p>
              Total proyecto:{" "}
              <strong>
                {formatMinor(
                  (() => {
                    try {
                      return parseMoneyToMinor(projectAmount);
                    } catch {
                      return BigInt(0);
                    }
                  })(),
                  "USD",
                )}
              </strong>
            </p>
            <p>
              Distribuido: <strong>{formatMinor(projectTotal, "USD")}</strong>
            </p>
            <p>
              Diferencia:{" "}
              <strong
                className={
                  (() => {
                    try {
                      return (
                        parseMoneyToMinor(projectAmount) - projectTotal ===
                        BigInt(0)
                      );
                    } catch {
                      return false;
                    }
                  })()
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {formatMinor(
                  (() => {
                    try {
                      const value =
                        parseMoneyToMinor(projectAmount) - projectTotal;
                      return value < 0 ? -value : value;
                    } catch {
                      return BigInt(0);
                    }
                  })(),
                  "USD",
                )}
              </strong>
            </p>
          </div>
          <button
            disabled={saving}
            className="min-h-12 rounded-xl bg-blue-700 font-black text-white"
          >
            Crear proyecto, plan y Cobros
          </button>
        </form>
      ) : null}
      {step === 2 ? (
        <section className="grid gap-4">
          <div className="kc-admin-card p-4">
            <label className="grid gap-2 text-sm font-bold">
              Proyecto
              <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                className="min-h-11 rounded-xl border px-3"
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <BillingPanel
            items={projectReceivables}
            summary={[]}
            total={projectReceivables.length}
            page={1}
            pageSize={50}
            canManage
            historicalMode
            contextLabel="Pagos anteriores del proyecto: seleccione uno o varios Cobros y registre la fecha real recibida."
          />
          <button
            onClick={() => setStep(3)}
            className="min-h-11 rounded-xl border font-black"
          >
            Continuar al servicio mensual
          </button>
        </section>
      ) : null}
      {step === 3 ? (
        <form onSubmit={saveRecurring} className="kc-admin-card grid gap-4 p-5">
          <h2 className="text-2xl font-black">
            Servicio mensual y vista previa
          </h2>
          <label className="grid gap-2 text-sm font-bold">
            Proyecto
            <select
              value={selectedProject}
              onChange={(event) => setSelectedProject(event.target.value)}
              required
              className="min-h-11 rounded-xl border px-3"
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2 text-sm font-bold">
              Nombre
              <input
                value={recurring.name}
                onChange={(event) =>
                  setRecurring((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Monto mensual USD
              <input
                value={recurring.amount}
                onChange={(event) =>
                  setRecurring((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                type="number"
                min="0.01"
                step="0.01"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Fecha de inicio
              <input
                value={recurring.startDate}
                onChange={(event) => {
                  setRecurring((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }));
                  setPreviewConfirmed(false);
                }}
                type="date"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Día de cobro
              <input
                value={recurring.billingDay}
                onChange={(event) => {
                  setRecurring((current) => ({
                    ...current,
                    billingDay: Number(event.target.value),
                  }));
                  setPreviewConfirmed(false);
                }}
                type="number"
                min="1"
                max="28"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
          </div>
          {preview ? (
            <div className="rounded-2xl border bg-slate-50 p-4">
              <h3 className="font-black">Vista previa de periodos</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {preview.periods.map((period) => (
                  <p
                    key={period.sequence}
                    className="rounded-xl bg-white p-3 text-sm"
                  >
                    <strong>{period.dueDate}</strong> ·{" "}
                    {formatMinor(period.amountMinor, "USD")}{" "}
                    {period.historical ? (
                      <span className="text-amber-700">Histórico</span>
                    ) : (
                      <span className="text-blue-700">Próximo</span>
                    )}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-sm">
                Total periodos: <strong>{preview.periods.length}</strong> ·
                Total mostrado:{" "}
                <strong>{formatMinor(preview.totalMinor, "USD")}</strong>
              </p>
              {preview.periods.some((item) => item.historical) ? (
                <label className="mt-3 flex min-h-11 items-center gap-3 font-bold">
                  <input
                    checked={previewConfirmed}
                    onChange={(event) =>
                      setPreviewConfirmed(event.target.checked)
                    }
                    type="checkbox"
                    className="h-5 w-5"
                  />{" "}
                  Confirmo estos periodos históricos
                </label>
              ) : null}
            </div>
          ) : null}
          <button
            disabled={saving || !selectedProject}
            className="min-h-12 rounded-xl bg-blue-700 font-black text-white"
          >
            Activar servicio y crear Cobros
          </button>
        </form>
      ) : null}
      {step === 4 ? (
        <section className="grid gap-4">
          <BillingPanel
            items={recurringReceivables}
            summary={[]}
            total={recurringReceivables.length}
            page={1}
            pageSize={50}
            canManage
            historicalMode
            contextLabel="Mensualidades anteriores: cada periodo pagado debe registrarse como un Pago real con su fecha recibida."
          />
          <button
            onClick={() => setStep(5)}
            className="min-h-11 rounded-xl border font-black"
          >
            Continuar a módulos adicionales
          </button>
        </section>
      ) : null}
      {step === 5 ? (
        <form onSubmit={createModule} className="kc-admin-card grid gap-4 p-5">
          <h2 className="text-2xl font-black">
            Registrar venta histórica de módulo
          </h2>
          <p className="text-sm text-kc-muted">
            Se conservará internamente el acuerdo, la venta, el plan y los
            Cobros sin fingir un envío de propuesta hoy.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Proyecto
              <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                required
                className="min-h-11 rounded-xl border px-3"
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Nombre
              <input
                name="name"
                required
                minLength={2}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Fecha de solicitud
              <input
                name="requestDate"
                type="date"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Fecha efectiva de venta
              <input
                name="effectiveDate"
                type="date"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Precio USD
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Estado de desarrollo
              <select
                name="workStatus"
                defaultValue="delivered"
                className="min-h-11 rounded-xl border px-3"
              >
                <option value="pending">Pendiente</option>
                <option value="scheduled">Programado</option>
                <option value="in_progress">En desarrollo</option>
                <option value="ready">Listo</option>
                <option value="delivered">Entregado</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Entrega real (si aplica)
              <input
                name="actualDeliveryDate"
                type="date"
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Cargo mensual adicional
              <input
                name="monthly"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0.00"
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Inicio cargo mensual
              <input
                name="monthlyStartDate"
                type="date"
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Día del cargo
              <input
                name="monthlyBillingDay"
                type="number"
                min="1"
                max="28"
                defaultValue="1"
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2">
              Descripción
              <input
                name="description"
                required
                minLength={2}
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2">
              Forma de pago
              <input
                name="paymentTerms"
                className="min-h-11 rounded-xl border px-3"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2">
              Notas de entrega
              <textarea
                name="deliveryNotes"
                rows={2}
                className="rounded-xl border p-3"
              />
            </label>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Cuotas del módulo</h3>
              <button
                type="button"
                onClick={() =>
                  setModuleRows((current) => [
                    ...current,
                    {
                      label: `Cuota ${current.length + 1}`,
                      amount: "0.00",
                      dueDate: "",
                    },
                  ])
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 font-black"
              >
                <Plus size={16} /> Agregar cuota
              </button>
            </div>
            {moduleRows.map((row, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[1fr_10rem_11rem_3rem]"
              >
                <input
                  aria-label={`Concepto módulo ${index + 1}`}
                  value={row.label}
                  onChange={(event) =>
                    updateRow(setModuleRows, index, "label", event.target.value)
                  }
                  className="min-h-11 rounded-xl border px-3"
                />
                <input
                  aria-label={`Monto módulo ${index + 1}`}
                  value={row.amount}
                  onChange={(event) =>
                    updateRow(
                      setModuleRows,
                      index,
                      "amount",
                      event.target.value,
                    )
                  }
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="min-h-11 rounded-xl border px-3"
                />
                <input
                  aria-label={`Fecha módulo ${index + 1}`}
                  value={row.dueDate}
                  onChange={(event) =>
                    updateRow(
                      setModuleRows,
                      index,
                      "dueDate",
                      event.target.value,
                    )
                  }
                  type="date"
                  required
                  className="min-h-11 rounded-xl border px-3"
                />
                <button
                  type="button"
                  aria-label={`Eliminar cuota módulo ${index + 1}`}
                  disabled={moduleRows.length === 1}
                  onClick={() =>
                    setModuleRows((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                  className="grid h-11 w-11 place-items-center rounded-xl border text-rose-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-blue-50 p-4">
            Distribuido: <strong>{formatMinor(moduleTotal, "USD")}</strong>
          </p>
          <button
            disabled={saving || !selectedProject}
            className="min-h-12 rounded-xl bg-blue-700 font-black text-white"
          >
            Registrar venta histórica y Cobros
          </button>
        </form>
      ) : null}
      {step === 6 ? (
        <section className="grid gap-4">
          <BillingPanel
            items={moduleReceivables}
            summary={[]}
            total={moduleReceivables.length}
            page={1}
            pageSize={50}
            canManage
            historicalMode
            contextLabel="Pagos anteriores de módulos: seleccione las obligaciones correspondientes y registre la fecha real."
          />
          <button
            onClick={() => setStep(7)}
            className="min-h-11 rounded-xl border font-black"
          >
            Revisar y finalizar
          </button>
        </section>
      ) : null}
      {step === 7 ? (
        <section className="kc-admin-card p-5">
          <CheckCircle2 size={30} className="text-emerald-700" />
          <h2 className="mt-3 text-2xl font-black">Revisión final</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-kc-muted">Proyectos</dt>
              <dd className="text-2xl font-black">{projects.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-kc-muted">Módulos</dt>
              <dd className="text-2xl font-black">{addOns.length}</dd>
            </div>
            <div>
              <dt className="text-sm text-kc-muted">Cobros pendientes</dt>
              <dd className="text-2xl font-black">
                {
                  receivables.filter(
                    (item) =>
                      item.paymentState === "open" ||
                      item.paymentState === "partially_paid",
                  ).length
                }
              </dd>
            </div>
          </dl>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-sm text-kc-muted">Mensualidades pagadas</p>
              <p className="mt-1 text-lg font-black">
                {formatMinor(recurringPaidMinor, "USD")}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-sm text-kc-muted">Pendiente histórico</p>
              <p className="mt-1 text-lg font-black">
                {formatMinor(recurringHistoricalPendingMinor, "USD")}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-sm text-kc-muted">Próximo cobro mensual</p>
              <p className="mt-1 text-lg font-black">
                {nextRecurringReceivable
                  ? formatMinor(nextRecurringReceivable.balanceMinor, "USD")
                  : "Sin cobro futuro"}
              </p>
              {nextRecurringReceivable ? (
                <p className="mt-1 text-xs text-kc-muted">
                  Fecha: {nextRecurringReceivable.dueDate}
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            Los vencimientos antiguos no generarán un envío retroactivo. Elija
            conscientemente si desea activar recordatorios para las obligaciones
            que continúan pendientes.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              disabled={saving}
              onClick={() => complete(false)}
              className="min-h-12 rounded-xl border font-black"
            >
              Finalizar y mantener recordatorios pausados
            </button>
            <button
              disabled={saving}
              onClick={() => complete(true)}
              className="min-h-12 rounded-xl bg-blue-700 font-black text-white"
            >
              Finalizar y activar recordatorios futuros
            </button>
          </div>
          {project ? (
            <p className="mt-4 text-sm text-kc-muted">
              Proyecto seleccionado: {project.name}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
