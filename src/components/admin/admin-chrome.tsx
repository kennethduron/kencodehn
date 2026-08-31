"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, FolderKanban, Landmark, LogOut, Mail, Menu, MoreHorizontal, Puzzle, ReceiptText, Settings, ShieldCheck, UserRound, UserRoundCog, Users, WalletCards, X } from "lucide-react";
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
  { href: "/admin/modulos", label: "Módulos", icon: Puzzle, permission: "modules:view" },
  { href: "/admin/cobros", label: "Cobros", icon: ReceiptText, permission: "billing:view" },
  { href: "/admin/pagos", label: "Pagos", icon: WalletCards, permission: "billing:view" },
  { href: "/admin/finanzas", label: "Finanzas", icon: Landmark, permission: "finance:view" },
  { href: "/admin/tareas", label: "Tareas", icon: ClipboardList, permission: "tasks:view" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell, permission: "notifications:view" },
  { href: "/admin/mail", label: "Mail", icon: Mail, permission: "mail:use" },
  { href: "/admin/equipo", label: "Equipo", icon: UserRoundCog, permission: "users:manage" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, permission: "settings:view" },
  { href: "/admin/seguridad", label: "Seguridad", icon: ShieldCheck },
];

function isActive(pathname: string, href: string) { return pathname === href || (href !== "/admin" && pathname.startsWith(href)); }

function Avatar({ admin, className }: { admin: AdminUser; className: string }) {
  const initials = (admin.displayName || admin.email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "K";
  return admin.profilePhotoPath
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src="/api/admin/profile/photo" alt="" className={`${className} shrink-0 rounded-full object-cover`} />
    : <span className={`${className} grid shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700`}>{initials}</span>;
}

export function AdminChrome({ children, admin, unreadCount = 0, authProvider = "firebase" }: { children: React.ReactNode; admin: AdminUser; unreadCount?: number; authProvider?: CrmAuthProvider }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const visibleNavItems = navItems.filter((item) => item.href !== "/admin/seguridad" || authProvider === "supabase").filter((item) => !item.permission || hasPermission(admin, item.permission));

  useEffect(() => setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"), []);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); } };
    addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  useEffect(() => {
    if (!profileOpen) return;
    const onOutside = (event: MouseEvent) => { if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setProfileOpen(false); profileButtonRef.current?.focus(); } };
    document.addEventListener("mousedown", onOutside); addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onOutside); removeEventListener("keydown", onKey); };
  }, [profileOpen]);

  function toggleCollapsed() { setCollapsed((current) => { const next = !current; localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); return next; }); }
  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); router.refresh(); }
  const userLabel = admin.preferredName || admin.displayName || (admin.role === "owner" ? "Owner" : admin.role.replace("_", " "));

  const nav = (compact = false) => <nav className="kc-admin-nav mt-3 grid gap-0.5" aria-label="Navegación principal del CRM">{visibleNavItems.map((item) => {
    const Icon = item.icon; const active = isActive(pathname, item.href);
    const link = <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} aria-label={compact ? item.label : undefined} onClick={() => setMenuOpen(false)} className={`kc-admin-nav-link group relative flex min-h-10 items-center rounded-xl text-sm font-bold transition ${compact ? "justify-center px-2" : "gap-3 px-3.5"} ${active ? "is-active" : ""}`}><Icon size={18} className="shrink-0" />{!compact ? <span className="truncate">{item.label}</span> : null}{item.href === "/admin/notificaciones" && unreadCount > 0 ? compact ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-[#14243d]" /> : <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[0.68rem] font-black text-white">{unreadCount}</span> : null}</Link>;
    return compact ? <Tooltip key={item.href} label={item.label}>{link}</Tooltip> : link;
  })}</nav>;
  const mobilePrimary = visibleNavItems.filter((item) => ["/admin", "/admin/clientes", "/admin/proyectos", "/admin/mail"].includes(item.href));

  return <main className="kc-admin-theme min-h-screen bg-kc-bg text-kc-text"><div className={`kc-admin-workspace ${collapsed ? "is-collapsed" : ""}`}>
    <aside className="kc-admin-sidebar sticky top-0 hidden h-[100dvh] border-r border-white/10 px-3 py-3 lg:flex lg:flex-col" aria-label="Barra lateral">
      <Link href="/admin" className={`flex min-h-12 items-center rounded-xl ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 font-display text-lg font-black text-white">K</span>{!collapsed ? <span className="min-w-0"><strong className="block truncate font-display text-base font-black text-white">KEN CODE</strong><small className="block text-[0.65rem] font-black tracking-[.18em] text-sky-300">CRM</small></span> : null}</Link>
      <Tooltip label={collapsed ? "Expandir menú" : "Colapsar menú"}><button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menú" : "Colapsar menú"} aria-expanded={!collapsed} className="kc-sidebar-toggle absolute -right-3 top-5 z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md">{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button></Tooltip>
      <div className={`kc-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "is-collapsed" : ""}`}>{nav(collapsed)}</div>
      <div className={`mt-2 border-t border-white/10 pt-2 ${collapsed ? "grid place-items-center" : ""}`}>{collapsed ? <Tooltip label={`${userLabel} · Cerrar sesión`}><button type="button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid h-10 w-10 place-items-center rounded-xl text-slate-200 hover:bg-white/10"><LogOut size={18} aria-hidden="true" /></button></Tooltip> : <div className="flex items-center gap-2 rounded-xl bg-white/[0.055] p-2"><Avatar admin={admin} className="h-8 w-8 text-xs" /><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{userLabel}</strong><span className="block truncate text-[0.68rem] text-slate-300">{admin.email}</span></span><Tooltip label="Cerrar sesión"><button type="button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"><LogOut size={16} aria-hidden="true" /></button></Tooltip></div>}</div>
    </aside>
    {menuOpen ? <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú principal"><button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-slate-950/60" onClick={() => setMenuOpen(false)} /><aside className="kc-admin-sidebar relative flex h-[100dvh] w-[min(86vw,320px)] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"><div className="flex items-center justify-between"><Link href="/admin" onClick={() => setMenuOpen(false)} className="font-display text-lg font-black text-white">KEN CODE <small className="block text-[.65rem] tracking-[.18em] text-sky-300">CRM</small></Link><button ref={closeButtonRef} type="button" onClick={() => setMenuOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white" aria-label="Cerrar menú"><X size={20} /></button></div><div className="kc-sidebar-scroll min-h-0 flex-1 overflow-y-auto">{nav()}</div><button type="button" onClick={logout} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-4 font-bold text-white"><LogOut size={18} /> Cerrar sesión</button></aside></div> : null}
    <section className="min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0"><header className="kc-admin-header sticky top-0 z-40 border-b bg-white/92 backdrop-blur-xl"><div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-7"><button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl border bg-white lg:hidden" aria-label="Abrir menú"><Menu size={21} /></button><div className="hidden lg:block"><p className="text-sm font-black">Ken Code CRM</p><p className="text-xs text-kc-muted">Operación comercial y financiera</p></div><div className="ml-auto flex items-center gap-2">{hasPermission(admin, "notifications:view") ? <NotificationDropdown initialUnreadCount={unreadCount} /> : null}<div ref={profileMenuRef} className="relative"><button ref={profileButtonRef} type="button" onClick={() => setProfileOpen((value) => !value)} aria-label="Abrir menú de cuenta" title="Mi cuenta" aria-expanded={profileOpen} aria-haspopup="menu" className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-2 py-1.5 text-left hover:border-blue-300"><Avatar admin={admin} className="h-8 w-8 text-xs" /><span className="hidden min-w-0 sm:block"><strong className="block max-w-36 truncate text-xs capitalize">{userLabel}</strong><span className="block text-[.68rem] text-kc-muted">Cuenta activa</span></span><ChevronDown size={15} className={`hidden sm:block ${profileOpen ? "rotate-180" : ""}`} /></button>{profileOpen ? <div role="menu" aria-label="Menú de cuenta" className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"><div className="border-b border-slate-100 px-3 py-2"><strong className="block truncate text-sm">{userLabel}</strong><span className="block break-all text-xs text-kc-muted">{admin.email}</span></div><Link role="menuitem" href="/admin/perfil" onClick={() => setProfileOpen(false)} className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><UserRound size={17} /> Mi perfil</Link>{authProvider === "supabase" ? <Link role="menuitem" href="/admin/seguridad" onClick={() => setProfileOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><ShieldCheck size={17} /> Seguridad</Link> : null}<button role="menuitem" type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-rose-50"><LogOut size={17} /> Cerrar sesión</button></div> : null}</div></div></div></header><div className="kc-admin-content px-4 py-5 sm:px-6 lg:px-7 lg:py-6">{children}</div></section>
  </div><nav aria-label="Navegación móvil del CRM" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t bg-white/96 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-xl lg:hidden">{mobilePrimary.map((item) => { const Icon = item.icon; const active = isActive(pathname, item.href); return <Link key={item.href} href={item.href} className={`flex min-h-12 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-xl text-[.68rem] font-bold ${active ? "bg-blue-50 text-blue-700" : "text-slate-600"}`}><Icon size={19} /><span>{item.label === "Panel General" ? "Inicio" : item.label}</span></Link>; })}<button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-12 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-xl text-[.68rem] font-bold text-slate-600"><MoreHorizontal size={20} /><span>Más</span></button></nav></main>;
}
