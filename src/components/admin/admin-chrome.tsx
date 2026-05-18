"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, ClipboardList, LogOut, Users } from "lucide-react";
import type { AdminUser } from "@/lib/admin/types";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/tareas", label: "Tareas", icon: ClipboardList },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell },
];

export function AdminChrome({ children, admin, unreadCount = 0 }: { children: React.ReactNode; admin: AdminUser; unreadCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-kc-bg text-kc-text">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-white/10 bg-kc-bg-soft/80 p-5 lg:block">
          <Link href="/admin" className="block rounded-2xl border border-kc-cyan/25 bg-white/[0.04] p-4">
            <span className="block font-display text-2xl font-black">Ken Code</span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-[0.22em] text-kc-cyan">CRM privado</span>
          </Link>
          <nav className="mt-6 grid gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                    active ? "bg-kc-cyan/12 text-kc-cyan" : "text-kc-muted hover:bg-white/[0.04] hover:text-kc-text"
                  }`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.href === "/admin/notificaciones" && unreadCount > 0 ? (
                    <span className="ml-auto rounded-full bg-kc-lime px-2 py-0.5 text-[0.68rem] font-black text-kc-bg">{unreadCount}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-kc-bg/88 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-kc-cyan">Panel administrativo</p>
                <p className="text-sm text-kc-muted">{admin.email}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-kc-text transition hover:border-rose-300/45 hover:text-rose-200"
              >
                <LogOut size={17} aria-hidden="true" />
                Salir
              </button>
            </div>
          </header>
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-white/10 bg-kc-bg-soft/96 p-2 backdrop-blur-xl lg:hidden">
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
