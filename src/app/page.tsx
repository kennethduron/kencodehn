import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, MessageCircle } from "lucide-react";
import { ServiceCard, ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { Reveal } from "@/components/site/reveal";
import { SectionIntro } from "@/components/site/section-intro";
import { benefits, projects, services, testimonials } from "@/content/site-content";
import { createMetadata, site, whatsappLink } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | International Web Development Studio",
  description:
    "Ken Code is a premium web and software studio creating modern websites, landing pages, e-commerce and digital systems for businesses around the world.",
  path: "/",
  keywords: ["páginas web profesionales", "diseño web para negocios", "international web development", "remote web studio"],
});

const homeSchema = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.name,
  url: site.url,
  image: `${site.url}${site.ogImage}`,
  logo: `${site.url}${site.favicon}`,
  email: site.email,
  telephone: site.phone,
  areaServed: ["Global", "United States", "Canada", "Europe", "Latin America", "Honduras"],
  sameAs: [site.facebook],
  makesOffer: services.map((service) => service.title),
};

export default function Home() {
  const featuredServices = services.slice(0, 4);
  const featuredProjects = projects.slice(0, 3);

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={homeSchema} />
      <section className="relative overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,0.22),transparent_34rem)]" />
        <div className="kc-shell grid min-h-[calc(100vh-5rem)] items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-14">
          <Reveal>
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-kc-cyan/30 bg-kc-cyan/10 px-4 py-2 text-sm font-bold text-kc-cyan shadow-[0_0_30px_rgba(0,217,255,0.14)]">
                International Web & Software Studio
              </p>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-black leading-[1.04] text-kc-text sm:text-5xl lg:text-7xl">
                Premium websites for modern businesses growing worldwide
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">
                Ken Code crea experiencias web modernas para empresas, marcas y emprendedores que trabajan localmente o de forma remota con clientes de cualquier parte del mundo.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/cotizar"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white shadow-[0_0_38px_rgba(0,109,255,0.38)] transition hover:bg-kc-cyan hover:text-kc-bg"
                >
                  Solicitar cotización
                  <MessageCircle size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/proyectos"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-kc-border bg-white/5 px-6 py-3 text-sm font-bold text-kc-text transition hover:border-kc-turquoise hover:text-kc-turquoise"
                >
                  Ver proyectos
                  <ExternalLink size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal className="relative">
            <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-kc-cyan/25 bg-kc-card p-3 shadow-[0_0_90px_rgba(0,217,255,0.16)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
                <Image
                  src={site.portrait}
                  alt="Kenneth Durón, desarrollador web de Ken Code"
                  fill
                  priority
                  sizes="(max-width: 768px) 90vw, 420px"
                  className="object-cover"
                />
              </div>
              <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-kc-bg/82 p-4 backdrop-blur-md">
                <p className="font-display text-xl font-black text-kc-text">Ken Code</p>
                <p className="mt-1 text-sm leading-6 text-kc-muted">Remote-ready builds with Next.js, TypeScript, Firebase and Vercel.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="kc-shell py-14">
        <SectionIntro
          eyebrow="Servicios"
          title="Digital solutions for businesses that need a stronger online presence."
          copy="Fast, responsive and conversion-focused websites ready for local and international clients."
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredServices.map((service) => (
            <ServiceCard key={service.slug} title={service.title} summary={service.summary} icon={service.icon} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/servicios" className="inline-flex items-center gap-2 text-sm font-black text-kc-cyan hover:text-kc-turquoise">
            Ver todos los servicios
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] py-14">
        <div className="kc-shell">
          <SectionIntro
            eyebrow="Proyectos"
            title="Selected work built with business goals in mind."
            copy="Every project improves clarity, trust and the path from visitor to qualified conversation."
          />
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <ProjectCard key={project.slug} {...project} />
            ))}
          </div>
        </div>
      </section>

      <section className="kc-shell py-14">
        <SectionIntro
          eyebrow="Beneficios"
          title="A web presence built for growth, not just for being online."
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <Icon className="text-kc-lime" size={24} aria-hidden="true" />
                <h3 className="mt-4 font-display text-xl font-bold text-kc-text">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-7 text-kc-muted">{benefit.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-kc-bg-soft/55 py-14">
        <div className="kc-shell">
          <SectionIntro eyebrow="Testimonios" title="Clients building a stronger digital presence." />
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <figure key={testimonial.name} className="kc-card rounded-2xl p-6">
                <blockquote className="text-base leading-8 text-kc-text">"{testimonial.quote}"</blockquote>
                <figcaption className="mt-6 text-sm text-kc-muted">
                  <strong className="block text-kc-cyan">{testimonial.name}</strong>
                  {testimonial.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        href={whatsappLink("Hola Ken Code. Quiero cotizar una solución web profesional para mi negocio. Podemos trabajar de forma remota.")}
        label="Escribir por WhatsApp"
      />
    </main>
  );
}
