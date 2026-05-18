import Link from "next/link";
import { ArrowRight } from "lucide-react";

type CTASectionProps = {
  title?: string;
  copy?: string;
  href?: string;
  label?: string;
};

export function CTASection({
  title = "Listo para construir una presencia digital mas fuerte?",
  copy = "Creemos una experiencia web rapida, premium y enfocada en conversion para tu negocio, sin importar donde esten tus clientes.",
  href = "/cotizar",
  label = "Cotizar proyecto",
}: CTASectionProps) {
  return (
    <section className="kc-shell py-14">
      <div className="rounded-2xl border border-kc-cyan/25 bg-[linear-gradient(135deg,rgba(0,109,255,0.24),rgba(0,230,168,0.12))] p-6 text-center shadow-[0_0_80px_rgba(0,217,255,0.12)] transition duration-300 hover:border-kc-cyan/45 hover:shadow-[0_0_92px_rgba(0,217,255,0.16)] sm:p-10">
        <h2 className="font-display text-3xl font-black text-kc-text sm:text-5xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-kc-muted">{copy}</p>
        <Link
          href={href}
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white shadow-[0_0_26px_rgba(0,109,255,0.24)] transition hover:-translate-y-0.5 hover:bg-kc-cyan hover:text-kc-bg hover:shadow-[0_0_34px_rgba(0,217,255,0.22)]"
        >
          {label}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
