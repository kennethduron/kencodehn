import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ServiceCardProps = {
  title: string;
  summary: string;
  icon: LucideIcon;
};

export function ServiceCard({ title, summary, icon: Icon }: ServiceCardProps) {
  return (
    <article className="kc-card rounded-xl p-5">
      <span className="grid h-11 w-11 place-items-center rounded-lg border border-kc-cyan/25 bg-kc-cyan/10 text-kc-cyan">
        <Icon size={21} aria-hidden="true" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold text-kc-text">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-kc-muted">{summary}</p>
    </article>
  );
}

type ProjectCardProps = {
  slug: string;
  name: string;
  category: string;
  technologies: string[];
  result: string;
};

export function ProjectCard({ slug, name, category, technologies, result }: ProjectCardProps) {
  return (
    <article className="kc-card rounded-2xl p-6">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-kc-cyan">{category}</p>
      <h3 className="mt-3 font-display text-2xl font-black text-kc-text">{name}</h3>
      <p className="mt-4 text-sm leading-7 text-kc-muted">{result}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {technologies.map((tech) => (
          <span key={tech} className="rounded-full border border-kc-turquoise/25 bg-kc-turquoise/10 px-3 py-1 text-xs font-bold text-kc-turquoise">
            {tech}
          </span>
        ))}
      </div>
      <Link
        href={`/proyectos/${slug}`}
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-kc-border px-4 py-2 text-sm font-bold text-kc-text transition hover:border-kc-cyan hover:text-kc-cyan"
      >
        Ver caso
        <ExternalLink size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

type PackageCardProps = {
  name: string;
  price: string;
  audience: string;
  includes: string[];
  featured?: boolean;
};

export function PackageCard({ name, price, audience, includes, featured }: PackageCardProps) {
  return (
    <article
      className={`rounded-2xl border p-6 ${
        featured
          ? "border-kc-lime/45 bg-kc-lime/[0.07] shadow-[0_0_54px_rgba(182,255,59,0.12)]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <p className="text-sm font-black uppercase tracking-[0.2em] text-kc-cyan">{price}</p>
      <h3 className="mt-3 font-display text-2xl font-black text-kc-text">{name}</h3>
      <p className="mt-3 text-sm leading-7 text-kc-muted">{audience}</p>
      <ul className="mt-6 space-y-3">
        {includes.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-kc-muted">
            <Check className="mt-0.5 shrink-0 text-kc-turquoise" size={17} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/cotizar"
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white/8 px-4 py-2 text-sm font-black text-kc-text transition hover:bg-kc-cyan hover:text-kc-bg"
      >
        Cotizar paquete
      </Link>
    </article>
  );
}
