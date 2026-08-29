"use client";

import { useState } from "react";
import { AlertTriangle, Bell, LockKeyhole, Mail, MonitorSmartphone, Palette, ShieldCheck, Smartphone, Trash2, X } from "lucide-react";
import type { AdminSettings } from "@/lib/admin/types";
import { PushSettings } from "./push-settings";
import { ConfirmDialog, Toast } from "./ui";

type SettingKey = keyof Omit<AdminSettings, "updatedAt" | "updatedByUid" | "updatedBy">;

type CleanupSummary = {
  leads: number;
  notes: number;
  tasks: number;
  notifications: number;
  activityLogs: number;
  emailLogs: number;
  pushLogs: number;
};

type CleanupVerification = {
  countsMatchBackup: boolean;
  activeOwnerCount: number;
  reminderEventCount: number;
};

const cleanupLabels: Record<keyof CleanupSummary, string> = {
  leads: "Leads",
  notes: "Notas",
  tasks: "Tareas",
  notifications: "Notificaciones",
  activityLogs: "Activity logs",
  emailLogs: "Email logs",
  pushLogs: "Push logs",
};

const groups: Array<{
  title: string;
  description: string;
  icon: typeof Bell;
  items: Array<{ key: SettingKey; label: string; description: string }>;
}> = [
  {
    title: "Notificaciones",
    description: "Define que avisos se muestran dentro del CRM privado.",
    icon: Bell,
    items: [
      {
        key: "internalNotificationsEnabled",
        label: "Mostrar notificaciones internas en el CRM",
        description: "Mantiene badges, centro de notificaciones y avisos dentro del panel.",
      },
      {
        key: "notificationSoundEnabled",
        label: "Reproducir sonido dentro del CRM",
        description: "Base preparada para sonidos de aviso cuando el CRM este abierto.",
      },
    ],
  },
  {
    title: "Email",
    description: "Controla los correos automaticos enviados al administrador.",
    icon: Mail,
    items: [
      {
        key: "emailNotificationsEnabled",
        label: "Recibir notificaciones por email",
        description: "Te enviaremos correos cuando lleguen nuevos leads o cuando una tarea requiera atencion.",
      },
      {
        key: "dailySummaryEnabled",
        label: "Recibir resumen diario por correo",
        description: "Queda preparado para un resumen diario de leads, tareas y actividad.",
      },
    ],
  },
  {
    title: "Push",
    description: "Permite alertas del navegador o celular cuando hay eventos importantes.",
    icon: Smartphone,
    items: [
      {
        key: "pushNotificationsEnabled",
        label: "Recibir notificaciones push",
        description: "Permite enviar push a dispositivos activos si el navegador lo soporta.",
      },
    ],
  },
  {
    title: "Recordatorios de tareas",
    description: "Ajusta que recordatorios dispara el worker automatico cada 10 minutos.",
    icon: MonitorSmartphone,
    items: [
      { key: "taskReminder1DayEnabled", label: "Recordarme 1 dia antes", description: "Recibe un aviso automatico antes de que venza una tarea." },
      { key: "taskReminder1HourEnabled", label: "Recordarme 1 hora antes", description: "Recibe un aviso cercano para preparar el seguimiento." },
      { key: "taskDueEnabled", label: "Recordarme al momento exacto", description: "Avisa en la siguiente ejecucion del cron cuando llega la hora configurada." },
      { key: "taskOverdueEnabled", label: "Avisarme si la tarea esta vencida", description: "Marca y avisa tareas que ya requieren atencion inmediata." },
    ],
  },
  {
    title: "Apariencia",
    description: "Preferencias visuales para trabajar rapido en pantallas pequenas.",
    icon: Palette,
    items: [
      {
        key: "compactModeEnabled",
        label: "Usar vista compacta en el CRM",
        description: "Base preparada para interfaces mas densas en operaciones diarias.",
      },
    ],
  },
];

const sensitiveDisableMessages: Partial<Record<SettingKey, string>> = {
  emailNotificationsEnabled: "Podrias dejar de recibir correos importantes cuando lleguen leads o tareas que requieren atencion.",
  pushNotificationsEnabled: "Podrias dejar de recibir avisos en este dispositivo o navegador.",
  internalNotificationsEnabled: "El CRM dejara de crear badges y avisos internos para eventos importantes.",
  taskReminder1DayEnabled: "El cron no enviara recordatorios un dia antes de las tareas.",
  taskReminder1HourEnabled: "El cron no enviara recordatorios una hora antes de las tareas.",
  taskDueEnabled: "El cron no avisara cuando una tarea llegue a la hora exacta configurada.",
  taskOverdueEnabled: "El cron no avisara automaticamente cuando una tarea este vencida.",
  dailySummaryEnabled: "No recibiras el resumen diario cuando esa funcion se active por completo.",
};

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kc-cyan ${
        checked ? "border-kc-cyan/50 bg-kc-cyan" : "border-white/15 bg-white/10"
      }`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function AdminSettingsPanel({ initialSettings, canRunMaintenance }: { initialSettings: AdminSettings; canRunMaintenance: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [pendingToggle, setPendingToggle] = useState<SettingKey | null>(null);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupSummary, setCleanupSummary] = useState<CleanupSummary | null>(null);
  const [cleanupVerification, setCleanupVerification] = useState<CleanupVerification | null>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [isLoadingCleanupSummary, setIsLoadingCleanupSummary] = useState(false);
  const [isCleaningCrm, setIsCleaningCrm] = useState(false);

  function showToast(message: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function requestToggle(key: SettingKey) {
    if (settings[key] && sensitiveDisableMessages[key]) {
      setPendingToggle(key);
      return;
    }
    toggle(key);
  }

  async function toggle(key: SettingKey) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingKey(key);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emailNotificationsEnabled: next.emailNotificationsEnabled,
          pushNotificationsEnabled: next.pushNotificationsEnabled,
          internalNotificationsEnabled: next.internalNotificationsEnabled,
          taskReminder1DayEnabled: next.taskReminder1DayEnabled,
          taskReminder1HourEnabled: next.taskReminder1HourEnabled,
          taskDueEnabled: next.taskDueEnabled,
          taskOverdueEnabled: next.taskOverdueEnabled,
          dailySummaryEnabled: next.dailySummaryEnabled,
          notificationSoundEnabled: next.notificationSoundEnabled,
          compactModeEnabled: next.compactModeEnabled,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "No se pudo guardar.");
      setSettings(data.settings);
      showToast("Configuracion actualizada correctamente.");
    } catch {
      setSettings(settings);
      showToast("No se pudo guardar la configuracion.", "error");
    } finally {
      setSavingKey(null);
    }
  }

  async function openCleanupDialog() {
    setCleanupOpen(true);
    setCleanupSummary(null);
    setCleanupVerification(null);
    setCleanupError("");
    setCleanupConfirmation("");
    setIsLoadingCleanupSummary(true);
    try {
      const response = await fetch("/api/admin/phase1-baseline");
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "No se pudo cargar el resumen.");
      }
      setCleanupSummary(data.summary);
      setCleanupVerification(data.verification);
    } catch {
      setCleanupOpen(false);
      showToast("No se pudo cargar el resumen de limpieza.", "error");
    } finally {
      setIsLoadingCleanupSummary(false);
    }
  }

  async function runCleanup() {
    if (cleanupConfirmation !== "PRE_CLEAN_BASELINE") {
      showToast("Escribe PRE_CLEAN_BASELINE para confirmar.", "error");
      return;
    }
    setIsCleaningCrm(true);
    setCleanupError("");
    try {
      const response = await fetch("/api/admin/phase1-baseline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: cleanupConfirmation }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "No se pudo limpiar.");
      }
      setCleanupOpen(false);
      setCleanupConfirmation("");
      setCleanupSummary(data.result.deletedCounts);
      showToast("Baseline limpio establecido correctamente. Ya puedes comenzar con clientes reales.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo establecer el baseline.";
      setCleanupError(message);
      showToast(message, "error");
    } finally {
      setIsCleaningCrm(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Toast message={toast} variant={toastVariant} />
      <ConfirmDialog
        open={Boolean(pendingToggle)}
        title="Confirmar cambio importante"
        description={pendingToggle ? `Seguro que deseas desactivar esta preferencia? ${sensitiveDisableMessages[pendingToggle]}` : ""}
        confirmText="Si, desactivar"
        cancelText="Cancelar"
        variant="danger"
        loading={savingKey === pendingToggle}
        onCancel={() => setPendingToggle(null)}
        onConfirm={async () => {
          if (!pendingToggle) return;
          const key = pendingToggle;
          setPendingToggle(null);
          await toggle(key);
        }}
      />
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-kc-cyan">Configuracion</p>
        <h1 className="mt-2 font-display text-3xl font-black text-kc-text">Preferencias del CRM</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-kc-muted">
          Ajusta como Ken Code CRM envia avisos, correos, recordatorios y preferencias visuales. Los cambios se guardan en Supabase y se aplican en el servidor.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-kc-cyan/25 bg-kc-cyan/10 text-kc-cyan">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-black text-kc-text">{group.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-kc-muted">{group.description}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {group.items.map((item) => (
                  <div key={item.key} className="grid gap-4 rounded-xl border border-white/10 bg-kc-bg/55 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="min-w-0">
                      <p className="font-bold text-kc-text">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-kc-muted">{item.description}</p>
                      {savingKey === item.key ? <p className="mt-2 text-xs font-bold text-kc-cyan">Guardando...</p> : null}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-kc-muted sm:hidden">{settings[item.key] ? "Activo" : "Inactivo"}</span>
                      <Switch checked={Boolean(settings[item.key])} onChange={() => requestToggle(item.key)} label={item.label} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-kc-lime/25 bg-kc-lime/10 text-kc-lime">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-black text-kc-text">Seguridad</h2>
              <p className="mt-1 text-sm leading-6 text-kc-muted">Base preparada para roles owner, admin, manager y viewer con permisos granulares.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-kc-muted">
            {["ver leads", "editar leads", "eliminar tareas", "ver reportes", "administrar configuracion", "administrar usuarios"].map((permission) => (
              <span key={permission} className="flex items-center gap-2 rounded-xl border border-white/10 bg-kc-bg/55 px-4 py-3">
                <LockKeyhole size={15} className="text-kc-cyan" aria-hidden="true" />
                {permission}
              </span>
            ))}
          </div>
        </section>
        {canRunMaintenance ? <section className="rounded-2xl border border-rose-300/20 bg-rose-950/10 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/10 text-rose-200">
              <AlertTriangle size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-black text-rose-100">Zona de mantenimiento</h2>
              <p className="mt-1 text-sm leading-6 text-rose-100/75">
                Establece el baseline limpio verificado sin tocar usuarios admin, configuracion, tokens reales, reglas ni variables de entorno.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCleanupDialog}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-black text-white transition hover:bg-rose-800"
          >
            <Trash2 size={16} aria-hidden="true" />
            Establecer baseline limpio
          </button>
        </section> : null}
      </div>

      <PushSettings />

      {cleanupOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cleanup-title">
          <button type="button" aria-label="Cancelar" className="absolute inset-0 cursor-pointer" onClick={isCleaningCrm ? undefined : () => setCleanupOpen(false)} />
          <div className="kc-admin-card relative max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">Mantenimiento</p>
                <h2 id="cleanup-title" className="mt-2 font-display text-2xl font-black text-kc-text">Establecer baseline limpio del CRM?</h2>
                <p className="mt-2 text-sm leading-6 text-kc-muted">
                  Esta accion usa el respaldo cifrado y sus conteos exactos para eliminar leads, tareas, notas, notificaciones y logs operativos. No se eliminaran usuarios admin ni configuracion del CRM.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCleanupOpen(false)}
                disabled={isCleaningCrm}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-kc-muted transition hover:text-kc-text disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cancelar"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-kc-bg/55 p-4">
              <p className="text-sm font-black text-kc-text">Resumen antes de borrar</p>
              {isLoadingCleanupSummary ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-14 animate-pulse rounded-xl bg-white/10" />
                  ))}
                </div>
              ) : cleanupSummary ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(cleanupSummary).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-kc-muted">{cleanupLabels[key as keyof CleanupSummary]}</p>
                      <p className="mt-1 font-display text-2xl font-black text-kc-text">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-kc-muted">No se pudo cargar el resumen.</p>
              )}
            </div>

            {cleanupVerification ? (
              <div className={`mt-4 rounded-2xl border p-4 text-sm ${cleanupVerification.countsMatchBackup && cleanupVerification.activeOwnerCount === 1 ? "border-emerald-300/30 bg-emerald-50 text-emerald-900" : "border-rose-300/30 bg-rose-50 text-rose-900"}`}>
                <p className="font-black">Verificación de seguridad</p>
                <p className="mt-1">Conteos del backup: {cleanupVerification.countsMatchBackup ? "COINCIDEN" : "NO COINCIDEN"}</p>
                <p>Owner activo: {cleanupVerification.activeOwnerCount}</p>
                <p>Reminder events: {cleanupVerification.reminderEventCount}</p>
              </div>
            ) : null}

            {cleanupError ? <p role="alert" className="mt-4 rounded-xl border border-rose-300/30 bg-rose-50 p-3 text-sm font-bold text-rose-900">{cleanupError}</p> : null}

            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-950/20 p-4">
              <label className="grid gap-2 text-sm font-bold text-rose-100">
                Escribe PRE_CLEAN_BASELINE para confirmar
                <input
                  value={cleanupConfirmation}
                  onChange={(event) => setCleanupConfirmation(event.target.value)}
                  className="min-h-11 rounded-xl border border-rose-300/20 bg-kc-bg px-3 text-kc-text outline-none focus:border-rose-200"
                  placeholder="PRE_CLEAN_BASELINE"
                  disabled={isCleaningCrm}
                />
              </label>
              <p className="mt-3 text-xs leading-5 text-rose-100/70">
                Protegido: Owner, perfiles, adminSettings, deviceTokens, historial de migrations, variables de entorno, Resend, FCM y cron.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCleanupOpen(false)}
                disabled={isCleaningCrm}
                className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-black text-kc-text transition hover:border-kc-cyan/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runCleanup}
                disabled={isCleaningCrm || cleanupConfirmation !== "PRE_CLEAN_BASELINE" || isLoadingCleanupSummary || !cleanupVerification?.countsMatchBackup || cleanupVerification.activeOwnerCount !== 1}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-black text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCleaningCrm ? "Estableciendo..." : "Si, establecer baseline"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
