"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import type { AdminNotification } from "@/lib/admin/types";
import { notificationSeverityLabels, notificationTypeLabels, timeAgo } from "./admin-labels";
import { Tooltip } from "./ui";

const severityClass: Record<AdminNotification["severity"], string> = {
  info: "bg-kc-cyan/10 text-kc-cyan border-kc-cyan/25",
  success: "bg-emerald-300/10 text-emerald-200 border-emerald-300/25",
  warning: "bg-kc-lime/10 text-kc-lime border-kc-lime/25",
  danger: "bg-rose-300/10 text-rose-200 border-rose-300/25",
};

export function NotificationDropdown({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    function onNotificationsChanged(event: Event) {
      const unread = (event as CustomEvent<{ unreadCount?: unknown }>).detail?.unreadCount;
      if (typeof unread === "number" && Number.isFinite(unread)) setUnreadCount(Math.max(0, unread));
      fetchNotifications();
    }
    window.addEventListener("kc:notifications-changed", onNotificationsChanged);
    return () => window.removeEventListener("kc:notifications-changed", onNotificationsChanged);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch("/api/admin/notifications");
      if (!response.ok) return;
      const result = await response.json();
      if (result.ok) {
        setNotifications(result.notifications);
        setUnreadCount(result.notifications.filter((notification: AdminNotification) => !notification.read).length);
      }
    } catch {
      // A document navigation can cancel this optional refresh. Keep the
      // server-rendered unread count and let the next mounted view retry.
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    const result = await response.json();
    if (result.ok) {
      setNotifications(result.notifications);
      setUnreadCount(0);
    }
  }

  async function markRead(notification: AdminNotification) {
    if (!notification.read) {
      await fetch(`/api/admin/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      await fetchNotifications();
    }
    setOpen(false);
  }

  const latest = notifications.slice(0, 5);
  const panel = (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <p className="font-display text-lg font-black text-kc-text">Notificaciones</p>
          <p className="text-xs font-bold text-kc-muted">{unreadCount} sin leer</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={markAllRead} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-black text-kc-cyan">
            <CheckCheck size={15} /> Leer todas
          </button>
          <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-kc-text sm:hidden" aria-label="Cerrar notificaciones">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="max-h-[min(68vh,420px)] overflow-y-auto p-2">
        {latest.map((notification) => {
          const href = notification.actionUrl || "/admin/notificaciones";
          return (
            <Link key={notification.id} href={href} onClick={() => markRead(notification)} className={`block rounded-xl border p-3 transition hover:bg-white/[0.04] ${notification.read ? "border-transparent" : "border-kc-cyan/20 bg-kc-cyan/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-1 font-black text-kc-text">{notification.title}</p>
                {!notification.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" /> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-kc-muted">{notification.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-black ${severityClass[notification.severity]}`}>{notificationSeverityLabels[notification.severity]}</span>
                <span className="text-xs font-bold text-kc-muted">{notificationTypeLabels[notification.type] || "Actividad"}</span>
                <span className="ml-auto text-xs font-bold text-kc-muted">{timeAgo(notification.createdAt)}</span>
              </div>
            </Link>
          );
        })}
        {latest.length === 0 ? <p className="p-6 text-center text-sm text-kc-muted">No hay notificaciones.</p> : null}
      </div>
      <Link href="/admin/notificaciones" onClick={() => setOpen(false)} className="block border-t border-white/10 p-4 text-center text-sm font-black text-kc-cyan">
        Ver centro completo
      </Link>
    </>
  );

  return (
    <div className="relative" ref={ref}>
      <Tooltip label="Notificaciones">
        <button type="button" onClick={() => setOpen((value) => !value)} title="Notificaciones" className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-kc-text transition hover:border-kc-cyan/35 hover:text-kc-cyan" aria-label="Notificaciones" aria-expanded={open}>
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-400 px-1 text-[0.64rem] font-black text-white">{unreadCount}</span> : null}
        </button>
      </Tooltip>

      {open ? (
        <>
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm sm:hidden" aria-hidden="true" />
          <div className="fixed inset-x-3 top-20 z-[80] max-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-white/10 bg-kc-bg-soft shadow-2xl shadow-black/50 sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:z-50 sm:w-[min(92vw,380px)]">
            {panel}
          </div>
        </>
      ) : null}
    </div>
  );
}
