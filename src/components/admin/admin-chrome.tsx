"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bell, BriefcaseBusiness, ChevronLeft, ChevronRight, ClipboardList,
  FolderKanban, Landmark, LogOut, Menu, MoreHorizontal, Puzzle, ReceiptText, Settings,
  ShieldCheck, UserRoundCog, Users, WalletCards, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AdminPermission, AdminUser } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/authorization";
import { NotificationDropdown } from "./notification-dropdown";
import { Tooltip } from "./ui";
import type { CrmAuthProvider } from "@/lib/auth/provider";

const SIDEBAR_STORAGE_KEY = "kc-crm-sidebar-collapsed";
const navItems: Array<{ href: string; label: string; icon: typeof BarChart3; permission?: AdminPermission }> = [
  { href: "/admin", label: "Panel General", icon: BarChart3, permission: "reports:view" },
  { href: "/admin/leads", label: "Leads", icon: Users, permission: "leads:view" },
  { href: "/admin/clientes", label: "Clientes", icon: BriefcaseBusiness, permission: "clients:view" },
  { href: "/admin/proyectos", label: "Proyectos", icon: FolderKanban, permission: "projects:view" },
  { href: "/admin/modulos", label: "Modulos", icon: Puzzle, permission: "modules:view" },
  { href: "/admin/cobros", label: "Cobros", icon: ReceiptText, permission: "billing:view" },
  { href: "/admin/pagos", label: "Pagos", icon: WalletCards, permission: "billing:view" },
  { href: "/admin/finanzas", label: "Finanzas", icon: Landmark, permission: "finance:view" },
  { href: "/admin/tareas", label: "Tareas", icon: ClipboardList, permission: "tasks:view" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell, permission: "notifications:view" },
  { href: "/admin/equipo", label: "Equipo", icon: UserRoundCog, permission: "users:manage" },
  { href: "/admin/configuracion", label: "Configuracion", icon: Settings, permission: "settings:view" },
  { href: "/admin/seguridad", label: "Seguridad", icon: ShieldCheck },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

export function AdminChrome({ children, admin, unreadCount = 0, authProvider = "firebase" }: { children: React.ReactNode; admin: AdminUser; unreadCount?: number; authProvider?: CrmAuthProvider }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/admin/seguridad" && authProvider !== "supabase") return false;
    return !item.permission || hasPermission(admin, item.permission);
  });

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const nav = (compact = false) => (
    <nav className="kc-admin-nav mt-5 grid gap-1.5" aria-label="Navegacion principal del CRM">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={compact ? item.label : undefined}
            onClick={() => setMenuOpen(false)}
            className={`kc-admin-nav-link group relative flex min-h-11 items-center rounded-xl text-sm font-bold transition ${compact ? "justify-center px-2" : "gap-3 px-3.5"} ${active ? "is-active" : ""}`}
          >
            <Icon size={19} aria-hidden="true" className="shrink-0" />
            {!compact ? <span className="truncate">{item.label}</span> : null}
            {item.href === "/admin/notificaciones" && unreadCount > 0 ? (
              compact
                ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-[#14243d]" aria-label={`${unreadCount} sin leer`} />
                : <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[0.68rem] font-black text-white">{unreadCount}</span>
            ) : null}
          </Link>
        );
        return compact ? <Tooltip key={item.href} label={item.label}>{link}</Tooltip> : link;
      })}
    </nav>
  );

  const mobilePrimary = visibleNavItems.filter((item) => ["/admin", "/admin/clientes", "/admin/proyectos", "/admin/cobros"].includes(item.href));

  return (
    <main className="kc-admin-theme min-h-screen bg-kc-bg text-kc-text">
      <div className={`kc-admin-workspace ${collapsed ? "is-collapsed" : ""}`}>
        <aside className="kc-admin-sidebar sticky top-0 hidden h-screen border-r border-white/10 px-3 py-4 lg:flex lg:flex-col" aria-label="Barra lateral">
          <Link href="/admin" className={`kc-admin-brand flex min-h-14 items-center rounded-xl ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`} aria-label="Ken Code CRM">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 font-display text-lg font-black text-white shadow-lg shadow-blue-950/25">K</span>
            {!collapsed ? <span className="min-w-0"><strong className="block truncate font-display text-base font-black tracking-wide text-white">KEN CODE</strong><span className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-sky-300">CRM</span></span> : null}
          </Link>
          <Tooltip label={collapsed ? "Expandir menu" : "Colapsar menu"}>
            <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menu" : "Colapsar menu"} aria-expanded={!collapsed} className="kc-sidebar-toggle absolute -right-4 top-7 z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md">
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </Tooltip>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{nav(collapsed)}</div>
          <div className={`mt-3 border-t border-white/10 pt-3 ${collapsed ? "grid place-items-center" : ""}`}>
            {collapsed ? <Tooltip label={`${admin.role} · Cerrar sesion`}><button type="button" onClick={logout} aria-label="Cerrar sesion" className="grid h-11 w-11 place-items-center rounded-xl text-slate-200 transition hover:bg-white/10 hover:text-white"><LogOut size={19} /></button></Tooltip> : <div className="flex items-center gap-3 rounded-xl bg-white/[0.055] p-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-100 font-black text-blue-800">{admin.email.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{admin.role === "owner" ? "Owner" : admin.role}</strong><span className="block truncate text-xs text-slate-300">{admin.email}</span></span><button type="button" onClick={logout} aria-label="Cerrar sesion" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"><LogOut size={17} /></button></div>}
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
            <button type="button" aria-label="Cerrar menu" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <aside className="kc-admin-sidebar relative flex h-[100dvh] w-[min(86vw,320px)] flex-col border-r border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-lg font-black text-white">K</span><span className="font-display text-lg font-black text-white">KEN CODE <small className="block text-[0.65rem] tracking-[.18em] text-sky-300">CRM</small></span></Link>
                <button ref={closeButtonRef} type="button" onClick={() => setMenuOpen(false)} title="Cerrar menu" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.055] text-white" aria-label="Cerrar menu"><X size={20} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{nav(false)}</div>
              <button type="button" onClick={logout} aria-label="Cerrar sesion" className="inline-flex min-h-11 min-w-11 items-center gap-3 rounded-xl border border-white/10 px-4 font-bold text-white"><LogOut size={18} /> Cerrar sesion</button>
            </aside>
          </div>
        ) : null}

        <section className="min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
          <header className="kc-admin-header sticky top-0 z-40 border-b bg-white/92 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-7">
              <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(true)} title="Abrir menu" className="grid h-11 w-11 place-items-center rounded-xl border bg-white text-kc-text lg:hidden" aria-label="Abrir menu"><Menu size={21} /></button>
              <div className="hidden min-w-0 lg:block"><p className="text-sm font-black text-kc-text">Ken Code CRM</p><p className="text-xs text-kc-muted">Operacion comercial y financiera</p></div>
              <div className="ml-auto flex items-center gap-2">
                {hasPermission(admin, "notifications:view") ? <NotificationDropdown initialUnreadCount={unreadCount} /> : null}
                <div className="hidden items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 font-black text-blue-700">{admin.email.slice(0, 1).toUpperCase()}</span><span className="pr-1 text-left"><strong className="block text-xs capitalize text-kc-text">{admin.role === "owner" ? "Owner" : admin.role}</strong><span className="block text-[0.68rem] text-kc-muted">Cuenta activa</span></span></div>
              </div>
            </div>
          </header>
          <div className="kc-admin-content px-4 py-5 sm:px-6 lg:px-7 lg:py-6">{children}</div>
        </section>
      </div>

      <nav aria-label="Navegacion movil del CRM" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-white/96 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-xl lg:hidden">
        {mobilePrimary.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-12 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-xl text-[0.68rem] font-bold ${active ? "bg-blue-50 text-blue-700" : "text-slate-600"}`}><Icon size={19} aria-hidden="true" /><span className="mt-0.5">{item.label === "Panel General" ? "Inicio" : item.label}</span></Link>; })}
        <button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-12 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-xl text-[0.68rem] font-bold text-slate-600" aria-label="Abrir menu"><MoreHorizontal size={20} /><span className="mt-0.5">Mas</span></button>
      </nav>
    </main>
  );
}
