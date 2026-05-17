import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { projects } from "@/content/site-content";
import { absoluteUrl, createMetadata, site } from "@/lib/site";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);
  if (!project) return {};

  return createMetadata({
    title: `${project.name} | Caso de estudio`,
    description: `${project.name}: ${project.result}`,
    path: `/proyectos/${project.slug}`,
    keywords: [project.category, ...project.technologies],
  });
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    notFound();
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.name,
    url: absoluteUrl(`/proyectos/${project.slug}`),
    creator: {
      "@type": "Organization",
      name: site.name,
    },
    description: project.result,
  };

  return (
    <main className="min-h-screen overflow-x-hidden pt-28 sm:pt-32">
      <JsonLd data={schema} />
      <section className="kc-shell py-12">
        <Link href="/proyectos" className="inline-flex items-center gap-2 text-sm font-bold text-kc-cyan hover:text-kc-turquoise">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a proyectos
        </Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.24em] text-kc-cyan">{project.category}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-black leading-tight text-kc-text sm:text-6xl">
          {project.name}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">{project.result}</p>
      </section>

      <section className="kc-shell grid gap-5 py-8 lg:grid-cols-3">
        {[
          ["Problema", project.problem],
          ["Solución", project.solution],
          ["Resultado", project.result],
        ].map(([title, copy]) => (
          <article key={title} className="kc-card rounded-2xl p-6">
            <h2 className="font-display text-2xl font-black text-kc-text">{title}</h2>
            <p className="mt-4 text-sm leading-7 text-kc-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section className="kc-shell py-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">Tecnologías</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {project.technologies.map((tech) => (
              <span key={tech} className="inline-flex items-center gap-2 rounded-full border border-kc-turquoise/25 bg-kc-turquoise/10 px-3 py-1 text-xs font-bold text-kc-turquoise">
                <CheckCircle2 size={14} aria-hidden="true" />
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="kc-shell py-8">
        <div className="rounded-2xl border border-dashed border-kc-border bg-kc-bg-soft/70 p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">Capturas</h2>
          <p className="mt-3 text-sm leading-7 text-kc-muted">
            Las capturas específicas se pueden agregar cuando estén listas. La estructura del caso ya está preparada para mostrarlas sin cambiar la ruta.
          </p>
        </div>
      </section>

      <CTASection
        title="Want a project with this level of clarity?"
        copy="Ken Code can work remotely with your business to build a premium web experience ready for international clients."
      />
    </main>
  );
}
