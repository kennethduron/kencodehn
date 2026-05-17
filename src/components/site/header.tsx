"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/site/logo";

const navItems = [
  { label: "Inicio", href: "/#inicio" },
  { label: "Servicios", href: "/#servicios" },
  { label: "Proyectos", href: "/#proyectos" },
  { label: "Paquetes", href: "/#paquetes" },
  { label: "Testimonios", href: "/#testimonios" },
  { label: "Contacto", href: "/#contacto" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-kc-bg/82 backdrop-blur-xl">
      <nav className="kc-shell flex h-20 items-center justify-between gap-4" aria-label="Navegacion principal">
        <Link href="/" onClick={closeMenu} aria-label="Ken Coding inicio">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
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
            href="/#contacto"
            className="rounded-lg bg-kc-electric px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(0,109,255,0.3)] transition hover:bg-kc-cyan hover:text-kc-bg"
          >
            Cotizar
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-kc-border bg-white/5 text-kc-text lg:hidden"
          aria-label={isOpen ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
          onClick={() => setIsOpen((value) => !value)}
        >
          {isOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </nav>

      <div
        id="mobile-menu"
        className={`lg:hidden ${isOpen ? "block" : "hidden"}`}
      >
        <div className="mx-4 mb-4 rounded-2xl border border-kc-border bg-kc-bg-soft/96 p-3 shadow-2xl">
          {navItems.map((item) => (
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
            href="/#contacto"
            onClick={closeMenu}
            className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-kc-electric px-4 py-3 text-base font-bold text-white"
          >
            Cotizar
          </Link>
        </div>
      </div>
    </header>
  );
}
