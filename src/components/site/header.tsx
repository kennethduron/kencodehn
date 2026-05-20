"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/site/logo";
import { getAlternatePath, type Locale } from "@/lib/site";

const navItems: Record<Locale, { label: string; href: string }[]> = {
  es: [
    { label: "Inicio", href: "/" },
    { label: "Servicios", href: "/servicios" },
    { label: "Proyectos", href: "/proyectos" },
    { label: "Paquetes", href: "/paquetes" },
    { label: "Contacto", href: "/contacto" },
  ],
  en: [
    { label: "Home", href: "/en" },
    { label: "Services", href: "/en/services" },
    { label: "Projects", href: "/en/projects" },
    { label: "Packages", href: "/en/packages" },
    { label: "Contact", href: "/en/contact" },
  ],
};

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const locale: Locale = pathname.startsWith("/en") ? "en" : "es";
  const alternateHref = getAlternatePath(pathname, locale);
  const quoteHref = locale === "es" ? "/cotizar" : "/en/quote";
  const homeHref = "/";
  const logoSubtitle = locale === "es" ? "Estudio web" : "Web Studio";
  const quoteLabel = locale === "es" ? "Cotizar" : "Quote";

  function closeMenu() {
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", closeMenu, { passive: true });
    window.addEventListener("touchmove", closeMenu, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", closeMenu);
      window.removeEventListener("touchmove", closeMenu);
    };
  }, [isOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-kc-bg/82 backdrop-blur-xl">
      <nav className="kc-shell flex h-20 items-center justify-between gap-4" aria-label="Navegacion principal">
        <Link href={homeHref} onClick={closeMenu} aria-label={locale === "es" ? "Ir al inicio de Ken Code" : "Go to Ken Code home"} className="shrink-0 transition opacity-95 hover:opacity-100">
          <Logo subtitle={logoSubtitle} />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems[locale].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-kc-muted transition hover:bg-white/5 hover:text-kc-text"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={alternateHref}
            className="rounded-lg border border-kc-border px-4 py-2.5 text-sm font-black text-kc-text transition hover:border-kc-cyan hover:text-kc-cyan"
          >
            ES / EN
          </Link>
          <Link
            href={quoteHref}
            className="rounded-lg bg-kc-electric px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(0,109,255,0.3)] transition hover:bg-kc-cyan hover:text-kc-bg"
          >
            {quoteLabel}
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={alternateHref}
            onClick={closeMenu}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-kc-border bg-white/5 px-3 text-xs font-black text-kc-text transition hover:border-kc-cyan hover:text-kc-cyan"
            aria-label={locale === "es" ? "Cambiar a ingles" : "Switch to Spanish"}
          >
            ES / EN
          </Link>
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-kc-border bg-white/5 text-kc-text"
            aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsOpen((value) => !value)}
          >
            {isOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        aria-hidden={!isOpen}
        className={`absolute inset-x-0 top-20 transition duration-200 lg:hidden ${
          isOpen
            ? "visible pointer-events-auto translate-y-0 opacity-100"
            : "invisible pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div ref={menuRef} className="mx-4 mb-4 rounded-2xl border border-kc-border bg-kc-bg-soft/96 p-3 shadow-2xl">
          {navItems[locale].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={closeMenu}
              className="block rounded-xl px-4 py-3 text-base font-semibold text-kc-muted transition hover:bg-white/5 hover:text-kc-text"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={quoteHref}
            onClick={closeMenu}
            className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-kc-electric px-4 py-3 text-base font-bold text-white"
          >
            {quoteLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
