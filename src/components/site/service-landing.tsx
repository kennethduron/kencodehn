import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { SectionIntro } from "@/components/site/section-intro";
import { projects } from "@/content/site-content";
import { seoServices, type SeoService } from "@/content/seo-services";
import { absoluteUrl, site } from "@/lib/site";

type ServiceLandingProps = {
  service: SeoService;
};

export function ServiceLanding({ service }: ServiceLandingProps) {
  const relatedProjects = service.relatedProjects
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter(Boolean);
  const relatedServices = service.relatedServices
    .map((slug) => seoServices.find((item) => item.slug === slug))
    .filter(Boolean);
  const serviceUrl = absoluteUrl(`/servicios/${service.slug}`);
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Servicios", item: absoluteUrl("/servicios") },
      { "@type": "ListItem", position: 3, name: service.title, item: serviceUrl },
    ],
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: service.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.metaDescription,
    provider: {
      "@type": "ProfessionalService",
      name: site.name,
      url: site.url,
      email: site.email,
      telephone: site.phone,
      sameAs: [site.facebook, site.instagram],
    },
    areaServed: ["Honduras", "Latinoamerica", "Estados Unidos", "Internacional"],
    url: serviceUrl,
    inLanguage: "es",
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      <PageHero
        eyebrow="Servicio SEO"
        title={service.h1}
        copy={service.intro}
        primaryLabel={service.cta}
        primaryHref="/cotizar"
        secondaryLabel="Hablar por contacto"
        secondaryHref="/contacto"
      />

      <section className="kc-shell grid gap-5 py-10 lg:grid-cols-2">
        <article className="kc-card rounded-2xl p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-kc-cyan">Problema</p>
          <h2 className="mt-4 font-display text-3xl font-black text-kc-text">Lo que frena a muchos negocios</h2>
          <p className="mt-4 text-base leading-8 text-kc-muted">{service.problem}</p>
        </article>
        <article className="kc-card rounded-2xl p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-kc-lime">Solucion</p>
          <h2 className="mt-4 font-display text-3xl font-black text-kc-text">Como ayuda Ken Code</h2>
          <p className="mt-4 text-base leading-8 text-kc-muted">{service.solution}</p>
        </article>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] py-14">
        <div className="kc-shell">
          <SectionIntro
            eyebrow="Beneficios"
            title="Una web pensada para generar confianza, contacto y seguimiento."
            copy="Cada servicio combina claridad comercial, experiencia movil y una base tecnica preparada para que Google y los clientes entiendan mejor tu negocio."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {service.benefits.map((benefit) => (
              <div key={benefit} className="rounded-xl border border-white/10 bg-kc-bg/70 p-5">
                <CheckCircle2 className="text-kc-turquoise" size={22} aria-hidden="true" />
                <h3 className="mt-4 text-lg font-black text-kc-text">{benefit}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="kc-shell grid gap-8 py-14 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <SectionIntro eyebrow="Incluye" title="Lo esencial para lanzar con una base profesional." />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {service.includes.map((item) => (
              <div key={item} className="rounded-xl border border-kc-border bg-white/[0.04] px-4 py-3 text-sm font-bold text-kc-text">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionIntro eyebrow="Proceso" title="Un camino ordenado desde la idea hasta el lanzamiento." />
          <ol className="mt-7 grid gap-3">
            {service.process.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-kc-electric text-sm font-black text-white">{index + 1}</span>
                <span className="pt-2 text-sm font-bold text-kc-text">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-white/10 bg-kc-bg-soft/55 py-14">
        <div className="kc-shell">
          <SectionIntro eyebrow="Proyectos relacionados" title="Casos que conectan con este tipo de solucion." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {relatedProjects.map((project) =>
              project ? (
                <Link key={project.slug} href={`/proyectos/${project.slug}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-kc-cyan/45">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-kc-cyan">{project.category}</p>
                  <h3 className="mt-3 font-display text-2xl font-black text-kc-text">{project.name}</h3>
                  <p className="mt-3 text-sm leading-7 text-kc-muted">{project.result}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-kc-turquoise">
                    Ver caso
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </Link>
              ) : null
            )}
          </div>
        </div>
      </section>

      <section className="kc-shell py-14">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionIntro eyebrow="Servicios relacionados" title="Tambien puede interesarte." />
            <div className="mt-7 grid gap-3">
              {relatedServices.map((item) =>
                item ? (
                  <Link key={item.slug} href={`/servicios/${item.slug}`} className="flex items-center justify-between gap-4 rounded-xl border border-kc-border bg-white/[0.04] p-4 text-sm font-black text-kc-text transition hover:border-kc-cyan/45 hover:text-kc-cyan">
                    {item.title}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : null
              )}
              <Link href="/paquetes" className="flex items-center justify-between gap-4 rounded-xl border border-kc-border bg-white/[0.04] p-4 text-sm font-black text-kc-text transition hover:border-kc-lime/45 hover:text-kc-lime">
                Ver paquetes
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div>
            <SectionIntro eyebrow="FAQ" title="Preguntas frecuentes antes de cotizar." />
            <div className="mt-7 grid gap-4">
              {service.faq.map((item) => (
                <article key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="font-display text-xl font-black text-kc-text">{item.question}</h2>
                  <p className="mt-3 text-sm leading-7 text-kc-muted">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Listo para convertir esta idea en una solucion real?"
        copy="Solicita una cotización y revisamos el camino más conveniente para tu negocio, tu mercado y tu etapa actual."
        href="/cotizar"
        label={service.cta}
      />
    </main>
  );
}
