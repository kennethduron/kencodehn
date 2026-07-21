"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { SocialLinks } from "@/components/site/social-links";
import { type Locale } from "@/lib/site";

const footerLinks: Record<Locale, { label: string; href: string }[]> = {
  es: [
    { label: "Servicios", href: "/servicios" },
    { label: "Proyectos", href: "/proyectos" },
    { label: "Paquetes", href: "/paquetes" },
    { label: "Sobre mi", href: "/sobre-mi" },
    { label: "Blog", href: "/blog" },
    { label: "Cotizar", href: "/cotizar" },
  ],
  en: [
    { label: "Services", href: "/en/services" },
    { label: "Projects", href: "/en/projects" },
    { label: "Packages", href: "/en/packages" },
    { label: "About", href: "/en/about" },
    { label: "Blog", href: "/en/blog" },
    { label: "Quote", href: "/en/quote" },
  ],
};

export function Footer() {
  const pathname = usePathname();
  const locale: Locale = pathname.startsWith("/en") ? "en" : "es";
  const copy =
    locale === "es"
      ? "Ken Code es un estudio web premium que crea experiencias digitales modernas para negocios, fundadores y marcas que trabajan localmente e internacionalmente."
      : "Ken Code is a premium web studio building modern digital experiences for businesses, founders and brands working locally and internationally.";
  const whatsappMessage =
    locale === "es"
      ? "Hola Ken Code. Quiero informacion para una solucion web profesional."
      : "Hello Ken Code. I want information about a professional web solution.";

  return (
    <footer className="border-t border-white/10 bg-kc-bg-soft/70">
      <div className="kc-shell grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Logo variant="footer" />
          <p className="mt-4 max-w-xl text-sm leading-6 text-kc-muted">{copy}</p>
          <SocialLinks className="mt-5" whatsappMessage={whatsappMessage} />
        </div>
        <div className="flex flex-wrap gap-3">
          {footerLinks[locale].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg border border-kc-border px-3 py-2 text-sm font-semibold text-kc-muted transition hover:border-kc-cyan hover:text-kc-cyan"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 py-5">
        <p className="kc-shell text-sm text-kc-muted">© 2026 Ken Code. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
