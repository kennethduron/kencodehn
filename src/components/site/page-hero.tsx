import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  copy: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function PageHero({
  eyebrow,
  title,
  copy,
  primaryLabel = "Solicitar cotización",
  primaryHref = whatsappLink("Hola Ken Code. Quiero cotizar una página web profesional."),
  secondaryLabel,
  secondaryHref,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,0.22),transparent_34rem)]" />
      <div className="kc-shell py-12 sm:py-16">
        <div className="max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-kc-cyan">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-black leading-[1.05] text-kc-text sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">{copy}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              target={primaryHref.startsWith("http") ? "_blank" : undefined}
              rel={primaryHref.startsWith("http") ? "noopener noreferrer" : undefined}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white shadow-[0_0_38px_rgba(0,109,255,0.38)] transition hover:bg-kc-cyan hover:text-kc-bg"
            >
              {primaryLabel}
              <MessageCircle size={18} aria-hidden="true" />
            </Link>
            {secondaryLabel && secondaryHref ? (
              <Link
                href={secondaryHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-kc-border bg-white/5 px-6 py-3 text-sm font-bold text-kc-text transition hover:border-kc-turquoise hover:text-kc-turquoise"
              >
                {secondaryLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
