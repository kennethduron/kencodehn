"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CheckCheck, Search, Trash2, Undo2 } from "lucide-react";
import type { AdminNotification } from "@/lib/admin/types";
import { notificationSeverityLabels, notificationTypeLabels, timeAgo } from "./admin-labels";
import { ConfirmDialog, Toast } from "./ui";

const severityClass: Record<AdminNotification["severity"], string> = {
  info: "border-kc-cyan/25 bg-kc-cyan/10 text-kc-cyan",
  success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  warning: "border-kc-lime/25 bg-kc-lime/10 text-kc-lime",
  danger: "border-rose-300/25 bg-rose-300/10 text-rose-200",
};

export function NotificationsPanel({ initialNotifications }: { initialNotifications: AdminNotification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [readFilter, setReadFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error" | "info">("success");
  const [confirmDelete, setConfirmDelete] = useState<AdminNotification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const types = useMemo(() => Array.from(new Set(notifications.map((notification) => notification.type))).sort(), [notifications]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notifications.filter((notification) => {
      const readOk = readFilter === "all" || (readFilter === "unread" ? !notification.read : notification.read);
      const typeOk = typeFilter === "all" || notification.type === typeFilter;
      const severityOk = severityFilter === "all" || notification.severity === severityFilter;
      const queryOk = !needle || [notification.title, notification.message].some((value) => value.toLowerCase().includes(needle));
      return readOk && typeOk && severityOk && queryOk;
    });
  }, [notifications, query, readFilter, severityFilter, typeFilter]);

  async function refreshFromResult(result: { ok: boolean; notifications?: AdminNotification[]; message?: string }) {
    if (result.ok && result.notifications) {
      setNotifications(result.notifications);
      return true;
    }
    showToast(result.message || "No se pudo completar la accion", "error");
    return false;
  }

  async function setRead(id: string, read: boolean) {
    const response = await fetch(`/api/admin/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    const result = await response.json();
    if (await refreshFromResult(result)) {
      showToast(read ? "Notificacion marcada como leida." : "Notificacion marcada como no leida.");
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    const result = await response.json();
    if (await refreshFromResult(result)) {
      showToast("Todas marcadas como leidas.");
    }
  }

  async function remove(id: string) {
    setIsDeleting(true);
    const response = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    const result = await response.json();
    setIsDeleting(false);
    if (await refreshFromResult(result)) {
      setConfirmDelete(null);
      showToast("Eliminado correctamente.");
    }
  }

  function showToast(message: string, variant: "success" | "error" | "info" = "success") {
    setToastVariant(variant);
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="grid gap-6">
      <Toast message={toast} variant={toastVariant} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Notificaciones</p>
          <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Centro de alertas</h1>
          <p className="mt-2 text-sm text-kc-muted">{unreadCount} notificaciones sin leer</p>
        </div>
        <button type="button" onClick={markAllRead} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-kc-cyan/30 bg-kc-cyan/10 px-4 text-sm font-black text-kc-cyan">
          <CheckCheck size={17} /> Marcar todas
        </button>
      </div>

      <div className="kc-admin-card grid gap-3 p-4 md:grid-cols-[1fr_repeat(3,180px)]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kc-muted" size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar notificaciones" className="min-h-12 w-full rounded-xl border border-white/10 bg-kc-bg pl-10 pr-4 text-sm text-kc-text outline-none focus:border-kc-cyan" />
        </label>
        <select value={readFilter} onChange={(event) => setReadFilter(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
          <option value="all">Todas</option>
          <option value="unread">No leidas</option>
          <option value="read">Leidas</option>
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
          <option value="all">Todos los tipos</option>
          {types.map((type) => <option key={type} value={type}>{notificationTypeLabels[type] || type}</option>)}
        </select>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-kc-bg px-3 text-sm font-bold text-kc-text">
          <option value="all">Gravedad</option>
          {Object.entries(notificationSeverityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <section className="grid gap-4">
        {filtered.map((notification) => (
          <article key={notification.id} className={`kc-admin-card p-5 ${notification.read ? "" : "border-kc-cyan/30"}`}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${severityClass[notification.severity]}`}>{notificationSeverityLabels[notification.severity]}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">{notificationTypeLabels[notification.type] || notification.type}</span>
                  {!notification.read ? <span className="rounded-full bg-rose-400 px-3 py-1 text-xs font-black text-white">Nueva</span> : null}
                </div>
                <p className="mt-4 font-display text-xl font-black text-kc-text">{notification.title}</p>
                <p className="mt-2 text-sm leading-7 text-kc-muted">{notification.message}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-kc-muted">{timeAgo(notification.createdAt)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-72 lg:grid-cols-1">
                {notification.actionUrl ? <Link href={notification.actionUrl} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kc-electric px-4 text-sm font-black text-white">Abrir</Link> : null}
                <button type="button" onClick={() => setRead(notification.id, !notification.read)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-black text-kc-text">
                  {notification.read ? <Undo2 size={16} /> : <Check size={16} />}
                  {notification.read ? "No leida" : "Leida"}
                </button>
                <button type="button" onClick={() => setConfirmDelete(notification)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 text-sm font-black text-rose-100">
                  <Trash2 size={16} /> Eliminar
                </button>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="kc-admin-card p-8 text-center">
            <p className="font-display text-2xl font-black text-kc-text">No hay notificaciones</p>
            <p className="mt-2 text-sm text-kc-muted">Cuando el CRM detecte actividad importante, aparecera aqui.</p>
          </div>
        ) : null}
      </section>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar notificacion"
        description="Estas seguro de que deseas eliminar esto? Esta accion no se puede deshacer."
        confirmText="Si, eliminar"
        cancelText="Cancelar"
        variant="danger"
        loading={isDeleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete ? remove(confirmDelete.id) : undefined}
      />
    </div>
  );
}
