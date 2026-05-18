"use client";

import { useState } from "react";
import type { AdminNotification } from "@/lib/admin/types";
import { dateTime } from "./admin-labels";

export function NotificationsPanel({ initialNotifications }: { initialNotifications: AdminNotification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);

  async function markRead(id: string) {
    const response = await fetch(`/api/admin/notifications/${id}`, { method: "PATCH" });
    const result = await response.json();
    if (result.ok) {
      setNotifications(result.notifications);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-kc-cyan">Notificaciones</p>
        <h1 className="mt-2 font-display text-3xl font-black text-kc-text sm:text-4xl">Alertas internas del CRM</h1>
      </div>
      <section className="grid gap-4">
        {notifications.map((notification) => (
          <article key={notification.id} className={`rounded-2xl border p-5 ${notification.read ? "border-white/10 bg-white/[0.03]" : "border-kc-cyan/30 bg-kc-cyan/10"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-xl font-black text-kc-text">{notification.title}</p>
                <p className="mt-2 text-sm leading-7 text-kc-muted">{notification.message}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-kc-muted">{dateTime(notification.createdAt)}</p>
              </div>
              {!notification.read ? (
                <button type="button" onClick={() => markRead(notification.id)} className="min-h-11 rounded-xl bg-kc-electric px-4 text-sm font-black text-white">
                  Marcar leida
                </button>
              ) : (
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-kc-muted">Leida</span>
              )}
            </div>
          </article>
        ))}
        {notifications.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-kc-muted">No hay notificaciones todavia.</p> : null}
      </section>
    </div>
  );
}
