import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ServiceCardProps = {
  title: string;
  summary: string;
  icon: LucideIcon;
  href?: string;
};

export function ServiceCard({ title, summary, icon: Icon, href }: ServiceCardProps) {
  const content = (
    <article className="kc-card group rounded-xl p-5">
      <span className="grid h-11 w-11 place-items-center rounded-lg border border-kc-cyan/25 bg-kc-cyan/10 text-kc-cyan transition duration-300 group-hover:border-kc-cyan/45 group-hover:bg-kc-cyan/15">
        <Icon size={21} aria-hidden="true" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold text-kc-text">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-kc-muted">{summary}</p>
    </article>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block h-full transition hover:-translate-y-0.5">
      {content}
    </Link>
  );
}

type ProjectCardProps = {
  slug: string;
  name: string;
  category: string;
  description: string;
  result: string;
  image: string;
  imageAlt: string;
  externalUrl?: string;
  benefits: string[];
  caseHref?: string;
  liveLabel?: string;
  caseLabel?: string;
};

export function ProjectCard({
  slug,
  name,
  category,
  description,
  result,
  image,
  imageAlt,
  externalUrl,
  benefits,
  caseHref,
  liveLabel = "Ver proyecto",
  caseLabel = "Ver caso de estudio",
}: ProjectCardProps) {
  return (
    <article className="kc-card group flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[2.1/1] overflow-hidden border-b border-white/10 bg-kc-bg-soft">
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1180px) 50vw, 560px"
          className="object-cover transition duration-700 group-hover:scale-[1.025]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-kc-bg/55 via-transparent to-transparent opacity-80" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-kc-cyan">{category}</p>
        <h3 className="mt-3 font-display text-2xl font-black text-kc-text">{name}</h3>
        <p className="mt-3 text-sm leading-7 text-kc-muted">{description}</p>
        <p className="mt-4 rounded-xl border border-kc-turquoise/20 bg-kc-turquoise/[0.06] p-4 text-sm font-semibold leading-7 text-kc-text">{result}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {benefits.map((benefit) => (
            <span key={benefit} className="rounded-full border border-kc-turquoise/25 bg-kc-turquoise/10 px-3 py-1 text-xs font-bold text-kc-turquoise">
              {benefit}
            </span>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
          <Link
            href={caseHref ?? `/proyectos/${slug}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-kc-border px-4 py-2 text-sm font-bold text-kc-text transition hover:-translate-y-0.5 hover:border-kc-cyan hover:text-kc-cyan"
          >
            {caseLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {externalUrl ? (
            <Link
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-kc-electric px-4 py-2 text-sm font-bold text-white shadow-[0_0_24px_rgba(0,109,255,0.2)] transition hover:-translate-y-0.5 hover:bg-kc-cyan hover:text-kc-bg hover:shadow-[0_0_32px_rgba(0,217,255,0.24)]"
            >
              {liveLabel}
              <ExternalLink size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type ScreenshotPanelProps = {
  image: string;
  imageAlt: string;
};

export function ScreenshotPanel({ image, imageAlt }: ScreenshotPanelProps) {
  return (
    <div className="relative aspect-[2.1/1] overflow-hidden rounded-2xl border border-white/10 bg-kc-bg-soft shadow-[0_0_60px_rgba(0,217,255,0.1)]">
      <Image
        src={image}
        alt={imageAlt}
        fill
        sizes="(max-width: 768px) 100vw, 980px"
        className="object-cover"
      />
    </div>
  );
}

type BenefitListProps = {
  items: string[];
};

export function BenefitList({ items }: BenefitListProps) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-2 rounded-full border border-kc-turquoise/25 bg-kc-turquoise/10 px-3 py-1 text-xs font-bold text-kc-turquoise">
          <Check size={14} aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

type PackageCardProps = {
  name: string;
  price: string;
  audience: string;
  includes: string[];
  featured?: boolean;
  quoteHref?: string;
  quoteLabel?: string;
};

export function PackageCard({
  name,
  price,
  audience,
  includes,
  featured,
  quoteHref = "/cotizar",
  quoteLabel = "Cotizar paquete",
}: PackageCardProps) {
  return (
    <article
      className={`rounded-2xl border p-6 transition duration-200 hover:-translate-y-1 ${
        featured
          ? "border-kc-lime/45 bg-kc-lime/[0.07] shadow-[0_0_54px_rgba(182,255,59,0.12)] hover:shadow-[0_0_64px_rgba(182,255,59,0.16)]"
          : "border-white/10 bg-white/[0.04] hover:border-kc-cyan/35"
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
        href={quoteHref}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white/8 px-4 py-2 text-sm font-black text-kc-text transition hover:-translate-y-0.5 hover:bg-kc-cyan hover:text-kc-bg"
      >
        {quoteLabel}
      </Link>
    </article>
  );
}
