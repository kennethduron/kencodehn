"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, ClipboardList, LogOut, Menu, Search, Settings, Sparkles, Users, X } from "lucide-react";
import { useState } from "react";
import type { AdminUser } from "@/lib/admin/types";
import { NotificationDropdown } from "./notification-dropdown";
import { Tooltip } from "./ui";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/tareas", label: "Tareas", icon: ClipboardList },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/admin/configuracion", label: "Config.", icon: Settings },
];

export function AdminChrome({ children, admin, unreadCount = 0 }: { children: React.ReactNode; admin: AdminUser; unreadCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const nav = (
    <nav className="mt-6 grid gap-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`group flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${
              active ? "bg-kc-cyan/12 text-kc-cyan ring-1 ring-kc-cyan/20" : "text-kc-muted hover:bg-white/[0.05] hover:text-kc-text"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
            {item.href === "/admin/notificaciones" && unreadCount > 0 ? (
              <span className="ml-auto rounded-full bg-rose-400 px-2 py-0.5 text-[0.68rem] font-black text-white shadow-[0_0_22px_rgba(251,113,133,0.35)]">{unreadCount}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <main className="min-h-screen bg-kc-bg text-kc-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,217,255,0.12),transparent_30rem),radial-gradient(circle_at_90%_10%,rgba(0,230,168,0.08),transparent_26rem)]" />
      <div className="relative grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-white/10 bg-kc-bg/84 p-5 backdrop-blur-xl lg:block">
          <Link href="/admin" className="block rounded-2xl border border-kc-cyan/20 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
            <span className="flex items-center gap-2 font-display text-2xl font-black">
              Ken Code
              <Sparkles size={18} className="text-kc-lime" aria-hidden="true" />
            </span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-[0.22em] text-kc-cyan">CRM privado</span>
          </Link>
          {nav}
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-kc-muted">Sesion activa</p>
            <p className="mt-2 truncate text-sm font-bold text-kc-text">{admin.email}</p>
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Cerrar menu" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <aside className="relative h-full w-[min(86vw,320px)] border-r border-white/10 bg-kc-bg-soft p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="font-display text-2xl font-black text-kc-text">Ken Code</Link>
                <Tooltip label="Cerrar menu">
                  <button type="button" onClick={() => setMenuOpen(false)} title="Cerrar menu" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar menu">
                    <X size={19} aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
              {nav}
            </aside>
          </div>
        ) : null}

        <section className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-kc-bg/86 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Tooltip label="Abrir menu">
                  <button type="button" onClick={() => setMenuOpen(true)} title="Abrir menu" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-kc-text lg:hidden" aria-label="Abrir menu">
                    <Menu size={20} aria-hidden="true" />
                  </button>
                </Tooltip>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-kc-cyan">Panel administrativo</p>
                  <p className="truncate text-sm text-kc-muted">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-kc-muted md:flex">
                  <Search size={16} aria-hidden="true" />
                  <span>CRM listo</span>
                </div>
                <NotificationDropdown initialUnreadCount={unreadCount} />
                <Tooltip label="Cerrar sesion">
                  <button type="button" onClick={logout} title="Cerrar sesion" aria-label="Cerrar sesion" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-kc-text transition hover:border-rose-300/45 hover:text-rose-200 sm:px-4">
                    <LogOut size={17} aria-hidden="true" />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </header>
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/10 bg-kc-bg-soft/96 p-2 backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl text-[0.68rem] font-bold ${active ? "bg-kc-cyan/12 text-kc-cyan" : "text-kc-muted"}`}>
              <Icon size={18} aria-hidden="true" />
              <span className="mt-1">{item.label}</span>
              {item.href === "/admin/notificaciones" && unreadCount > 0 ? <span className="absolute right-3 top-1 h-2.5 w-2.5 rounded-full bg-kc-lime" /> : null}
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
