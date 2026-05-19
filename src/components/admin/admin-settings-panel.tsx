"use client";

import { useState } from "react";
import { Bell, LockKeyhole, Mail, MonitorSmartphone, Palette, ShieldCheck, Smartphone } from "lucide-react";
import type { AdminSettings } from "@/lib/admin/types";
import { PushSettings } from "./push-settings";
import { Toast } from "./ui";

type SettingKey = keyof Omit<AdminSettings, "updatedAt" | "updatedBy">;

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

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kc-cyan ${
        checked ? "border-kc-cyan/50 bg-kc-cyan" : "border-white/15 bg-white/10"
      }`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function AdminSettingsPanel({ initialSettings }: { initialSettings: AdminSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");

  function showToast(message: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
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

  return (
    <div className="grid gap-6">
      <Toast message={toast} variant={toastVariant} />
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-kc-cyan">Configuracion</p>
        <h1 className="mt-2 font-display text-3xl font-black text-kc-text">Preferencias del CRM</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-kc-muted">
          Ajusta como Ken Code CRM envia avisos, correos, recordatorios y preferencias visuales. Los cambios se guardan en Firestore y se aplican en el servidor.
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
                  <div key={item.key} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-kc-bg/55 p-4">
                    <div className="min-w-0">
                      <p className="font-bold text-kc-text">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-kc-muted">{item.description}</p>
                      {savingKey === item.key ? <p className="mt-2 text-xs font-bold text-kc-cyan">Guardando...</p> : null}
                    </div>
                    <Switch checked={Boolean(settings[item.key])} onChange={() => toggle(item.key)} label={item.label} />
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
      </div>

      <PushSettings />
    </div>
  );
}
