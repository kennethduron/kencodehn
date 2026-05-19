"use client";

import { Bell, BellOff, CheckCircle2, Send, ShieldAlert, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { getFirebaseClient } from "@/lib/firebase/client";

type Device = {
  id: string;
  email: string;
  userAgent: string;
  platform: string;
  active: boolean;
  updatedAt: string;
};

type PushState = "checking" | "unsupported" | "missing_config" | "blocked" | "pending" | "active" | "error";

export function PushSettings() {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("Revisando compatibilidad del navegador...");
  const [token, setToken] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

  const status = useMemo(() => {
    if (state === "active") return { label: "Activadas", className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200", icon: CheckCircle2 };
    if (state === "blocked") return { label: "Bloqueadas", className: "border-rose-300/30 bg-rose-400/10 text-rose-200", icon: BellOff };
    if (state === "unsupported") return { label: "No soportadas", className: "border-amber-300/30 bg-amber-400/10 text-amber-100", icon: ShieldAlert };
    if (state === "missing_config") return { label: "Falta configuracion", className: "border-amber-300/30 bg-amber-400/10 text-amber-100", icon: ShieldAlert };
    return { label: "Pendientes", className: "border-kc-cyan/30 bg-kc-cyan/10 text-kc-cyan", icon: Bell };
  }, [state]);
  const StatusIcon = status.icon;

  async function loadDevices() {
    const response = await fetch("/api/admin/push/devices");
    if (response.ok) {
      const data = await response.json();
      setDevices(data.devices ?? []);
    }
  }

  useEffect(() => {
    async function check() {
      await loadDevices();
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setState("unsupported");
        setMessage("Este navegador no soporta notificaciones web push completas.");
        return;
      }
      if (!vapidKey || !messagingSenderId) {
        setState("missing_config");
        setMessage("Faltan NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID y/o NEXT_PUBLIC_FIREBASE_VAPID_KEY en Vercel para activar FCM Web Push.");
        return;
      }
      const supported = await isSupported();
      if (!supported) {
        setState("unsupported");
        setMessage("Firebase Messaging no esta disponible en este navegador.");
        return;
      }
      if (Notification.permission === "granted") {
        setState("active");
        setMessage("Este navegador tiene permiso para recibir push.");
      } else if (Notification.permission === "denied") {
        setState("blocked");
        setMessage("El permiso esta bloqueado. Activalo desde configuracion del navegador.");
      } else {
        setState("pending");
        setMessage("Puedes activar el permiso para recibir avisos aunque el CRM no este abierto.");
      }
    }
    check();
  }, [vapidKey]);

  async function activate() {
    setBusy(true);
    setMessage("Solicitando permiso y registrando dispositivo...");
    try {
      if (!vapidKey || !messagingSenderId) throw new Error("Faltan variables publicas de Firebase Messaging.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "pending");
        setMessage("Permiso no concedido.");
        return;
      }
      const firebase = getFirebaseClient();
      if (!firebase.ok) throw new Error(`Faltan variables Firebase: ${firebase.missing.join(", ")}`);
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = getMessaging(firebase.app);
      const nextToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!nextToken) throw new Error("Firebase no devolvio token para este dispositivo.");
      const response = await fetch("/api/admin/push/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: nextToken, userAgent: navigator.userAgent, platform: navigator.platform }),
      });
      if (!response.ok) throw new Error("No se pudo guardar el dispositivo.");
      setToken(nextToken);
      setState("active");
      setMessage("Notificaciones activadas en este dispositivo.");
      await loadDevices();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo activar push.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/push/test", { method: "POST" });
      const data = await response.json();
      setMessage(response.ok ? `Prueba enviada. Dispositivos: ${data.result?.sent ?? 0}.` : data.message || "No se pudo enviar prueba.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!token) {
      setMessage("Activa primero este dispositivo para poder desactivarlo desde aqui.");
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/admin/push/devices", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState("pending");
      setToken(null);
      setMessage("Dispositivo desactivado para futuros push.");
      await loadDevices();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-kc-cyan">Push notifications</p>
            <h1 className="mt-2 font-display text-3xl font-black text-kc-text">Notificaciones en navegador y celular</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-kc-muted">
              Activa este dispositivo para recibir avisos de leads y tareas aunque no tengas el CRM abierto. En iPhone requiere abrir la web desde la app instalada en pantalla de inicio.
            </p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-black ${status.className}`}>
            <StatusIcon size={16} /> {status.label}
          </span>
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-kc-bg/55 p-4 text-sm text-kc-muted">{message}</div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={activate} disabled={busy || state === "missing_config" || state === "unsupported"} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-kc-cyan px-4 text-sm font-black text-kc-bg disabled:cursor-not-allowed disabled:opacity-50">
            <Bell size={17} /> Activar notificaciones
          </button>
          <button type="button" onClick={sendTest} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-kc-text">
            <Send size={17} /> Enviar notificacion de prueba
          </button>
          <button type="button" onClick={deactivate} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 text-sm font-bold text-rose-100">
            <BellOff size={17} /> Desactivar este dispositivo
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <h2 className="font-display text-2xl font-black text-kc-text">Dispositivos registrados</h2>
        <div className="mt-4 grid gap-3">
          {devices.length === 0 ? <p className="rounded-xl border border-white/10 bg-kc-bg/55 p-4 text-sm text-kc-muted">No hay dispositivos registrados todavia.</p> : null}
          {devices.map((device) => (
            <div key={device.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-kc-bg/55 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kc-cyan/10 text-kc-cyan"><Smartphone size={18} /></span>
              <div className="min-w-0">
                <p className="font-bold text-kc-text">{device.platform || "Dispositivo web"}</p>
                <p className="mt-1 line-clamp-2 text-xs text-kc-muted">{device.userAgent || device.email}</p>
                <p className="mt-2 text-xs font-bold text-kc-muted">{device.active ? "Activo" : "Inactivo"}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
