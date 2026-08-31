"use client";

import { Bell, BellOff, CheckCircle2, Mail, Send, ShieldAlert, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createCurrentPushToken,
  deleteCurrentPushToken,
  getCurrentPushToken,
  getPushCapability,
} from "@/lib/push/client";
import { ConfirmDialog, Toast } from "./ui";

type Device = { id: string; email: string; userAgent: string; platform: string; active: boolean; updatedAt: string };
type Channel = "crm" | "push" | "email";
type EventKey = "mail_received" | "task_assigned" | "follow_up" | "billing" | "proposal_activity" | "team_activity";
type Preferences = {
  internalEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  events: Record<EventKey, Record<Channel, boolean>>;
};
type PushState = "checking" | "unsupported" | "blocked" | "pending" | "active" | "error";

const eventLabels: Array<{ key: EventKey; label: string }> = [
  { key: "mail_received", label: "Nuevo correo" },
  { key: "task_assigned", label: "Tarea asignada" },
  { key: "follow_up", label: "Seguimiento próximo" },
  { key: "billing", label: "Cobro importante" },
  { key: "proposal_activity", label: "Propuesta o actividad" },
  { key: "team_activity", label: "Actividad de equipo" },
];

function deviceName(device: Device) {
  const value = `${device.platform} ${device.userAgent}`.toLowerCase();
  if (value.includes("iphone")) return "iPhone";
  if (value.includes("ipad")) return "iPad";
  if (value.includes("android")) return value.includes("tablet") ? "Tablet Android" : "Android";
  if (value.includes("firefox")) return "Firefox";
  if (value.includes("edg")) return "Edge";
  if (value.includes("chrome")) return "Chrome";
  if (value.includes("safari")) return "Safari";
  return device.platform || "Navegador web";
}

function capabilityMessage(reason: string) {
  if (reason === "push_manager") return "Abra Ken Code CRM desde la aplicación instalada en la pantalla de inicio para activar notificaciones.";
  if (reason === "configuration") return "Las notificaciones todavía no están disponibles para este dispositivo.";
  return "Este navegador no ofrece las funciones necesarias para recibir notificaciones.";
}

export function PushSettings({ availableEvents = eventLabels.map((event) => event.key) }: { availableEvents?: EventKey[] }) {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("Revisando este dispositivo...");
  const [token, setToken] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");

  const status = useMemo(() => {
    if (state === "active") return { label: "Activadas", className: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: CheckCircle2 };
    if (state === "blocked") return { label: "Bloqueadas", className: "border-rose-300 bg-rose-50 text-rose-800", icon: BellOff };
    if (state === "unsupported") return { label: "No disponibles", className: "border-amber-300 bg-amber-50 text-amber-900", icon: ShieldAlert };
    if (state === "error") return { label: "Requiere atención", className: "border-rose-300 bg-rose-50 text-rose-800", icon: ShieldAlert };
    return { label: "No activadas", className: "border-blue-200 bg-blue-50 text-blue-800", icon: Bell };
  }, [state]);
  const StatusIcon = status.icon;

  function showToast(nextMessage: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(nextMessage);
    window.setTimeout(() => setToast(""), 2600);
  }

  function reportDiagnostic(stage: "capability" | "permission" | "worker" | "registration" | "test" | "deactivation", outcome: "success" | "unsupported" | "denied" | "failed") {
    const value = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    const platform = value.includes("iphone") || value.includes("ipad") || value.includes("ipod")
      ? "ios" : value.includes("android") ? "android" : value.includes("win") ? "windows" : value.includes("mac") ? "macos" : value.includes("linux") ? "linux" : "other";
    const permission = "Notification" in window ? Notification.permission : "unavailable";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
    fetch("/api/admin/push/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage, outcome, permission, platform, standalone }), keepalive: true }).catch(() => undefined);
  }

  async function loadDevices() {
    const response = await fetch("/api/admin/push/devices", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setDevices(data?.devices ?? []);
  }

  async function registerToken(nextToken: string) {
    const response = await fetch("/api/admin/push/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: nextToken, userAgent: navigator.userAgent, platform: navigator.platform }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.tokenId) throw new Error("device_registration_failed");
    setCurrentDeviceId(data.tokenId);
    return data.tokenId as string;
  }

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const preferencesResponse = await fetch("/api/admin/notification-preferences", { cache: "no-store" });
      const preferencesData = await preferencesResponse.json().catch(() => null);
      if (!cancelled && preferencesResponse.ok) {
        setPreferences(preferencesData.preferences);
        setNotificationEmail(preferencesData.notificationEmail ?? "");
      }
      await loadDevices();
      const capability = getPushCapability();
      if (!capability.supported) {
        reportDiagnostic("capability", "unsupported");
        if (!cancelled) {
          setState("unsupported");
          setMessage(capabilityMessage(capability.reason));
        }
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) {
          setState("blocked");
          setMessage("No tiene habilitadas las notificaciones para Ken Code CRM. Puede activarlas desde la configuración de su dispositivo.");
        }
        return;
      }
      if (Notification.permission !== "granted") {
        if (!cancelled) {
          setState("pending");
          setMessage("Active las notificaciones para recibir recordatorios y novedades importantes.");
        }
        return;
      }
      try {
        const nextToken = await getCurrentPushToken();
        if (!nextToken) throw new Error("token_unavailable");
        await registerToken(nextToken);
        if (!cancelled) {
          setToken(nextToken);
          setState("active");
          setMessage("Notificaciones activadas en este dispositivo.");
        }
        await loadDevices();
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("No pudimos completar la actualización de este dispositivo. Pulse Activar notificaciones para intentarlo nuevamente.");
        }
      }
    }
    check().catch(() => {
      if (!cancelled) {
        setState("error");
        setMessage("No pudimos revisar las notificaciones en este momento.");
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function activate() {
    setBusy(true);
    setMessage("Preparando este dispositivo...");
    try {
      const capability = getPushCapability();
      if (!capability.supported) {
        setState("unsupported");
        setMessage(capabilityMessage(capability.reason));
        return;
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        reportDiagnostic("permission", permission === "denied" ? "denied" : "failed");
        setState(permission === "denied" ? "blocked" : "pending");
        setMessage(permission === "denied"
          ? "No tiene habilitadas las notificaciones para Ken Code CRM. Puede activarlas desde la configuración de su dispositivo."
          : "El permiso no fue concedido. Puede intentarlo nuevamente cuando lo desee.");
        return;
      }
      const nextToken = await createCurrentPushToken();
      if (!nextToken) throw new Error("token_unavailable");
      await registerToken(nextToken);
      if (preferences && !preferences.pushEnabled) {
        const saved = await savePreferences({ ...preferences, pushEnabled: true }, false);
        if (!saved) throw new Error("push_preference_unavailable");
      }
      reportDiagnostic("registration", "success");
      setToken(nextToken);
      setState("active");
      setMessage("Notificaciones activadas en este dispositivo.");
      showToast("Este dispositivo quedó activado.");
      await loadDevices();
    } catch {
      reportDiagnostic("registration", "failed");
      setState("error");
      setMessage("No pudimos activar las notificaciones. Intente nuevamente.");
      showToast("No pudimos activar las notificaciones.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!currentDeviceId) {
      showToast("Active primero las notificaciones en este dispositivo.", "info");
      return;
    }
    setBusy(true);
    setMessage("Enviando una prueba a este dispositivo...");
    try {
      const response = await fetch("/api/admin/push/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: currentDeviceId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error("test_push_failed");
      reportDiagnostic("test", "success");
      setMessage("La prueba fue aceptada para este dispositivo.");
      showToast("Prueba enviada a este dispositivo.");
    } catch {
      reportDiagnostic("test", "failed");
      setMessage("No pudimos entregar la prueba a este dispositivo.");
      showToast("No pudimos enviar la prueba.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!token) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/push/devices", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("device_deactivation_failed");
      await deleteCurrentPushToken().catch(() => false);
      reportDiagnostic("deactivation", "success");
      setState("pending");
      setToken(null);
      setCurrentDeviceId(null);
      setMessage("Notificaciones desactivadas en este dispositivo.");
      setConfirmDeactivate(false);
      showToast("Este dispositivo quedó desactivado.");
      await loadDevices();
    } catch {
      reportDiagnostic("deactivation", "failed");
      showToast("No pudimos desactivar este dispositivo.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences(next: Preferences, announce = true) {
    const previous = preferences;
    setPreferences(next);
    setSavingPreference(true);
    try {
      const response = await fetch("/api/admin/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error("preferences_save_failed");
      setPreferences(data.preferences);
      if (announce) showToast("Preferencias actualizadas.");
      return true;
    } catch {
      setPreferences(previous);
      if (announce) showToast("No pudimos guardar las preferencias.", "error");
      return false;
    } finally {
      setSavingPreference(false);
    }
  }

  function toggleMaster(key: "pushEnabled" | "emailEnabled") {
    if (!preferences || savingPreference) return;
    savePreferences({ ...preferences, [key]: !preferences[key] });
  }

  function toggleEvent(event: EventKey, channel: Channel) {
    if (!preferences || savingPreference) return;
    savePreferences({
      ...preferences,
      events: { ...preferences.events, [event]: { ...preferences.events[event], [channel]: !preferences.events[event][channel] } },
    });
  }

  return (
    <div className="grid gap-5">
      <Toast message={toast} variant={toastVariant} />
      <section className="rounded-2xl border border-kc-border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-kc-electric">Mis notificaciones</p>
            <h1 className="mt-2 font-display text-2xl font-black text-kc-heading sm:text-3xl">Notificaciones de Ken Code CRM</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-kc-muted">Controle cómo recibe avisos sobre la actividad que ya tiene permiso para consultar.</p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-black ${status.className}`}>
            <StatusIcon size={16} aria-hidden="true" /> {status.label}
          </span>
        </div>
        <div role="status" className="mt-4 rounded-xl border border-kc-border bg-kc-surface-soft p-4 text-sm leading-6 text-kc-muted">{message}</div>
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <button type="button" onClick={activate} disabled={busy || state === "unsupported"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            <Bell size={17} aria-hidden="true" /> Activar notificaciones
          </button>
          <button type="button" onClick={sendTest} disabled={busy || state !== "active" || !currentDeviceId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-border bg-white px-4 text-sm font-bold text-kc-heading disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={17} aria-hidden="true" /> Enviar notificación de prueba
          </button>
          <button type="button" onClick={() => setConfirmDeactivate(true)} disabled={busy || state !== "active"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-800 disabled:cursor-not-allowed disabled:opacity-50">
            <BellOff size={17} aria-hidden="true" /> Desactivar este dispositivo
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-kc-border bg-white p-4 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-black text-kc-heading">Canales personales</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button type="button" role="switch" aria-checked={preferences?.pushEnabled ?? false} onClick={() => toggleMaster("pushEnabled")} disabled={!preferences || savingPreference} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-kc-border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kc-electric">
            <span className="flex min-w-0 items-center gap-3"><Smartphone className="shrink-0 text-kc-electric" size={20} /><span><strong className="block text-kc-heading">Push</strong><span className="text-sm text-kc-muted">Avisos en sus dispositivos.</span></span></span>
            <span className="font-bold text-kc-heading">{preferences?.pushEnabled ? "Activadas" : "No activadas"}</span>
          </button>
          <button type="button" role="switch" aria-checked={preferences?.emailEnabled ?? false} onClick={() => toggleMaster("emailEnabled")} disabled={!preferences || savingPreference} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-kc-border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kc-electric">
            <span className="flex min-w-0 items-center gap-3"><Mail className="shrink-0 text-kc-electric" size={20} /><span className="min-w-0"><strong className="block text-kc-heading">Correo electrónico</strong><span className="block truncate text-sm text-kc-muted">{notificationEmail || "Correo de acceso"}</span></span></span>
            <span className="font-bold text-kc-heading">{preferences?.emailEnabled ? "Activadas" : "No activadas"}</span>
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-kc-muted">Las invitaciones, la recuperación de contraseña y los avisos críticos de seguridad no dependen de estas preferencias.</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-kc-border bg-white shadow-sm">
        <div className="p-4 sm:p-6"><h2 className="font-display text-xl font-black text-kc-heading">Preferencias por tipo</h2><p className="mt-1 text-sm text-kc-muted">Solo se entregarán eventos que su rol y permisos le permitan consultar.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr className="border-t border-kc-border bg-kc-surface-soft text-left text-kc-muted"><th className="px-4 py-3 sm:px-6">Tipo de aviso</th><th className="px-3 py-3 text-center">CRM</th><th className="px-3 py-3 text-center">Push</th><th className="px-3 py-3 text-center sm:px-6">Correo</th></tr></thead>
            <tbody>{eventLabels.filter((event) => availableEvents.includes(event.key)).map((event) => <tr key={event.key} className="border-t border-kc-border"><th className="px-4 py-3 text-left font-bold text-kc-heading sm:px-6">{event.label}</th>{(["crm", "push", "email"] as Channel[]).map((channel) => <td key={channel} className="px-3 py-3 text-center sm:last:px-6"><input type="checkbox" aria-label={`${event.label}: ${channel === "crm" ? "CRM" : channel === "push" ? "Push" : "Correo"}`} checked={preferences?.events[event.key][channel] ?? false} disabled={!preferences || savingPreference} onChange={() => toggleEvent(event.key, channel)} className="h-5 w-5 accent-blue-600" /></td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-kc-border bg-white p-4 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-black text-kc-heading">Mis dispositivos</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {devices.length === 0 ? <p className="rounded-xl border border-dashed border-kc-border bg-kc-surface-soft p-4 text-sm text-kc-muted">No hay dispositivos activos todavía.</p> : null}
          {devices.map((device) => <div key={device.id} className="flex items-start gap-3 rounded-xl border border-kc-border p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-kc-electric"><Smartphone size={19} aria-hidden="true" /></span><div className="min-w-0"><p className="font-bold text-kc-heading">{deviceName(device)}</p><p className="mt-1 text-sm text-emerald-700">{device.active ? "Notificaciones activadas" : "No activadas"}</p><p className="mt-1 truncate text-xs text-kc-muted">Actualizado {new Date(device.updatedAt).toLocaleDateString("es-HN")}</p></div></div>)}
        </div>
      </section>

      <ConfirmDialog open={confirmDeactivate} title="Desactivar este dispositivo" description="Este dispositivo dejará de recibir avisos de su cuenta. Podrá activarlo nuevamente cuando lo necesite." confirmText="Desactivar" cancelText="Cancelar" variant="danger" loading={busy} onCancel={() => setConfirmDeactivate(false)} onConfirm={deactivate} />
    </div>
  );
}
