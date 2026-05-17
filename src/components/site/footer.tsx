import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { site } from "@/lib/site";

const footerLinks = [
  { label: "Servicios", href: "/servicios" },
  { label: "Proyectos", href: "/proyectos" },
  { label: "Paquetes", href: "/paquetes" },
  { label: "Sobre mí", href: "/sobre-mi" },
  { label: "Blog", href: "/blog" },
  { label: "Cotizar", href: "/cotizar" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-kc-bg-soft/70">
      <div className="kc-shell grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Logo />
          <p className="mt-4 max-w-xl text-sm leading-6 text-kc-muted">
            Ken Code crea sitios web modernos, rapidos y enfocados en ventas
            para negocios que quieren recibir mas cotizaciones.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-kc-muted">
            <a className="transition hover:text-kc-cyan" href={`mailto:${site.email}`}>
              {site.email}
            </a>
            <a className="transition hover:text-kc-cyan" href={`tel:+${site.phoneRaw}`}>
              {site.phone}
            </a>
            <a
              className="transition hover:text-kc-cyan"
              href={site.facebook}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {footerLinks.map((item) => (
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
        <p className="kc-shell text-sm text-kc-muted">
          © 2026 Ken Code. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
