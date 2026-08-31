import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Facebook, Instagram, MailCheck, MessageCircle } from "lucide-react";
import { BenefitList, PackageCard, ProjectCard, ScreenshotPanel, ServiceCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionIntro } from "@/components/site/section-intro";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { getContent, type Project } from "@/content/site-content";
import { seoServices } from "@/content/seo-services";
import { absoluteAssetUrl, absoluteUrl, site, whatsappLink, type Locale } from "@/lib/site";
import { QuoteForm } from "./quote-form";

const labels = {
  es: {
    heroEyebrow: "Estudio web y software internacional",
    heroTitle: "Páginas web premium para negocios modernos que quieren crecer",
    heroCopy:
      "Ken Code crea páginas web y sistemas de negocio modernos, incluyendo facturación y contabilidad, para empresas, marcas y emprendedores que quieren crecer con procesos más claros.",
    quote: "Solicitar cotización",
    projects: "Ver proyectos",
    photoCaption: "Experiencias digitales listas para vender, contactar y crecer en diferentes mercados.",
    servicesTitle: "Soluciones web y sistemas para negocios que necesitan crecer con mayor control.",
    servicesCopy: "Páginas web, sistemas administrativos, contables y de facturación, CRM y automatización conectados con las operaciones del negocio.",
    allServices: "Ver todos los servicios",
    selectedWork: "Proyectos reales creados con objetivos de negocio.",
    selectedWorkCopy: "Cada proyecto mejora claridad, confianza y el camino del visitante hacia una conversación calificada.",
    benefitsTitle: "Una presencia web pensada para crecer, no solo para estar en internet.",
    testimonialsTitle: "Clientes construyendo una presencia digital más fuerte.",
    whatsappMessage: "Hola Ken Code. Quiero cotizar una solución web profesional para mi negocio. Podemos trabajar de forma remota.",
    whatsappLabel: "Cotizar proyecto",
    live: "Ver proyecto",
    case: "Ver caso de estudio",
    backProjects: "Volver a proyectos",
    problem: "Problema",
    solution: "Solución",
    result: "Resultado",
    benefits: "Beneficios",
    appliedServices: "Servicios aplicados",
    screenshot: "Vista del proyecto",
    projectCtaTitle: "¿Quieres una web con este nivel de claridad?",
    projectCtaCopy: "Ken Code puede trabajar de forma remota con tu negocio para crear una experiencia web premium lista para clientes internacionales.",
    quotePackage: "Cotizar paquete",
  },
  en: {
    heroEyebrow: "International web and software studio",
    heroTitle: "Premium websites for modern businesses ready to grow",
    heroCopy:
      "Ken Code builds modern websites and business systems, including accounting and invoicing, for companies, brands and founders ready to grow with clearer processes.",
    quote: "Request a quote",
    projects: "View projects",
    photoCaption: "Digital experiences ready to sell, connect and grow across markets.",
    servicesTitle: "Web solutions and business systems for companies ready to grow with more control.",
    servicesCopy: "Websites, administrative and accounting systems, invoicing, CRM and automation connected with business operations.",
    allServices: "View all services",
    selectedWork: "Real projects built around business goals.",
    selectedWorkCopy: "Each project improves clarity, trust and the path from visitor to qualified conversation.",
    benefitsTitle: "A web presence built for growth, not just for being online.",
    testimonialsTitle: "Clients building a stronger digital presence.",
    whatsappMessage: "Hello Ken Code. I want to quote a professional web solution for my business. We can work remotely.",
    whatsappLabel: "Quote project",
    live: "View project",
    case: "View case study",
    backProjects: "Back to projects",
    problem: "Problem",
    solution: "Solution",
    result: "Result",
    benefits: "Benefits",
    appliedServices: "Applied services",
    screenshot: "Project view",
    projectCtaTitle: "Want a website with this level of clarity?",
    projectCtaCopy: "Ken Code can work remotely with your business to build a premium web experience ready for international clients.",
    quotePackage: "Quote package",
  },
};

function path(locale: Locale, esPath: string, enPath: string) {
  return locale === "es" ? esPath : enPath;
}

function projectPath(locale: Locale, slug: string) {
  return locale === "es" ? `/proyectos/${slug}` : `/en/projects/${slug}`;
}

function cta(locale: Locale) {
  return locale === "es"
    ? {}
    : {
        title: "Ready to build a stronger digital presence?",
        copy: "Let's create a fast, premium and conversion-focused web experience for your business, wherever your clients are.",
        href: "/en/quote",
        label: "Quote project",
      };
}

export function HomeView({ locale }: { locale: Locale }) {
  const copy = labels[locale];
  const data = getContent(locale);
  const featuredServices = data.services.slice(0, 4);
  const featuredProjects = data.projects.slice(0, 3);
  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfessionalService",
        "@id": `${site.url}#organization`,
        name: site.name,
        alternateName: ["Ken Code Honduras"],
        url: site.url,
        image: absoluteAssetUrl(site.ogImage),
        logo: absoluteAssetUrl(site.brandLogo),
        email: site.email,
        telephone: site.phone,
        founder: { "@id": `${site.url}#kenneth-duron` },
        areaServed: ["Global", "United States", "Latin America", "Honduras"],
        sameAs: [site.facebook, site.instagram],
        makesOffer: data.services.map((service) => service.title),
        inLanguage: locale,
      },
      {
        "@type": "Person",
        "@id": `${site.url}#kenneth-duron`,
        name: "Kenneth Duron",
        alternateName: ["Kenneth Durón", "Kenneth Asael Duron Paz"],
        url: absoluteUrl(path(locale, "/sobre-mi", "/en/about")),
        image: absoluteAssetUrl(site.portrait),
        jobTitle: locale === "es" ? "Desarrollador web" : "Web developer",
        worksFor: { "@id": `${site.url}#organization` },
        sameAs: [site.facebook, site.instagram],
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}#website`,
        name: site.name,
        alternateName: ["Ken Code Honduras"],
        url: site.url,
        publisher: { "@id": `${site.url}#organization` },
        author: { "@id": `${site.url}#kenneth-duron` },
        inLanguage: locale,
      },
    ],
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={homeSchema} />
      <section className="kc-home-hero relative overflow-hidden pt-24 sm:pt-28 lg:pt-20 xl:pt-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,0.22),transparent_34rem)]" />
        <div className="kc-shell kc-home-hero-shell grid items-center gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)] lg:gap-10 lg:py-10">
          <Reveal>
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-kc-cyan/30 bg-kc-cyan/10 px-4 py-2 text-sm font-bold text-kc-cyan shadow-[0_0_30px_rgba(0,217,255,0.14)]">
                {copy.heroEyebrow}
              </p>
              <h1 className="kc-home-hero-title mt-6 max-w-5xl font-display text-[clamp(2.55rem,10.5vw,3.9rem)] font-black leading-[1.04] text-kc-text sm:text-[clamp(3rem,8vw,4.35rem)] lg:text-[clamp(3.25rem,4.25vw,4.05rem)] xl:text-[clamp(3.85rem,4.45vw,4.85rem)] 2xl:text-[5rem]">
                {copy.heroTitle}
              </h1>
              <p className="kc-home-hero-copy mt-6 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">{copy.heroCopy}</p>
              <div className="kc-home-hero-actions mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={path(locale, "/cotizar", "/en/quote")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white shadow-[0_0_38px_rgba(0,109,255,0.38)] transition hover:bg-kc-cyan hover:text-kc-bg"
                >
                  {copy.quote}
                  <MessageCircle size={18} aria-hidden="true" />
                </Link>
                <Link
                  href={path(locale, "/proyectos", "/en/projects")}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-kc-border bg-white/5 px-6 py-3 text-sm font-bold text-kc-text transition hover:border-kc-turquoise hover:text-kc-turquoise"
                >
                  {copy.projects}
                  <ExternalLink size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal className="kc-home-hero-media relative">
            <div className="kc-home-hero-card relative mx-auto overflow-hidden rounded-2xl border border-kc-cyan/25 bg-kc-card p-3 shadow-[0_0_90px_rgba(0,217,255,0.16)]">
              <div className="kc-home-hero-image relative aspect-[2/3] overflow-hidden rounded-xl">
                <Image
                  src={site.portrait}
                  alt={locale === "es" ? "Kenneth Duron, desarrollador web de Ken Code" : "Kenneth Duron, web developer at Ken Code"}
                  fill
                  priority
                  sizes="(max-width: 768px) 88vw, (max-width: 1280px) 340px, 420px"
                  className="object-cover object-top"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="kc-shell py-14">
        <SectionIntro eyebrow={locale === "es" ? "Servicios" : "Services"} title={copy.servicesTitle} copy={copy.servicesCopy} />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredServices.map((service) => (
            <ServiceCard key={service.slug} title={service.title} summary={service.summary} icon={service.icon} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href={path(locale, "/servicios", "/en/services")} className="inline-flex items-center gap-2 text-sm font-black text-kc-cyan hover:text-kc-turquoise">
            {copy.allServices}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] py-14">
        <div className="kc-shell">
          <SectionIntro eyebrow={locale === "es" ? "Proyectos" : "Projects"} title={copy.selectedWork} copy={copy.selectedWorkCopy} />
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <ProjectCard
                key={project.slug}
                {...project}
                caseHref={projectPath(locale, project.slug)}
                liveLabel={copy.live}
                caseLabel={copy.case}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="kc-shell py-14">
        <SectionIntro eyebrow={locale === "es" ? "Beneficios" : "Benefits"} title={copy.benefitsTitle} />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.benefits.map((benefit) => {
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
          <SectionIntro eyebrow={locale === "es" ? "Testimonios" : "Testimonials"} title={copy.testimonialsTitle} />
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {data.testimonials.map((testimonial) => (
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
        href={path(locale, "/cotizar", "/en/quote")}
        label={copy.whatsappLabel}
        {...cta(locale)}
      />
    </main>
  );
}

export function ServicesView({ locale }: { locale: Locale }) {
  const data = getContent(locale);
  const servicesSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: locale === "es" ? "Servicios web y sistemas para negocios de Ken Code" : "Ken Code web and business systems services",
    provider: { "@type": "ProfessionalService", name: site.name, url: site.url },
    areaServed: ["Global", "United States", "Canada", "Europe", "Latin America", "Honduras"],
    inLanguage: locale,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: locale === "es" ? "Servicios web" : "Web services",
      itemListElement: (locale === "es" ? seoServices : data.services).map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.title,
          description: "metaDescription" in service ? service.metaDescription : service.summary,
        },
      })),
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: data.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={servicesSchema} />
      <JsonLd data={faqSchema} />
      <PageHero
        eyebrow={locale === "es" ? "Servicios" : "Services"}
        title={locale === "es" ? "Desarrollo web y sistemas para las operaciones de negocios modernos." : "Web development and systems for modern business operations."}
        copy={locale === "es" ? "Desarrollamos páginas web, e-commerce y sistemas administrativos que pueden integrar facturación, cuentas por cobrar, cuentas por pagar, inventario, clientes y reportes financieros según el alcance de cada negocio." : "We build websites, e-commerce and administrative systems that can integrate invoicing, accounts receivable, accounts payable, inventory, customers and financial reports based on each business scope."}
        primaryLabel={locale === "es" ? "Solicitar cotización" : "Request a quote"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />

      <section className="kc-shell py-12">
        {locale === "es" ? (
          <div className="mb-12">
            <SectionIntro
              eyebrow="Servicios SEO"
              title="Soluciones específicas para búsquedas comerciales reales."
              copy="Estas páginas ayudan a negocios, restaurantes, tiendas, empresas de servicios y clientes internacionales a encontrar la solución exacta que necesitan."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {seoServices.map((service, index) => {
                const Icon = data.services[index % data.services.length].icon;
                return (
                  <ServiceCard
                    key={service.slug}
                    title={service.title}
                    summary={service.metaDescription}
                    icon={Icon}
                    href={`/servicios/${service.slug}`}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.services.map((service) => (
            <ServiceCard key={service.slug} title={service.title} summary={service.detail} icon={service.icon} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] py-16">
        <div className="kc-shell">
          <SectionIntro
            eyebrow={locale === "es" ? "Beneficios" : "Benefits"}
            title={locale === "es" ? "Lo que una presencia web premium aporta a tu negocio." : "What a premium web presence brings to your business."}
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article key={benefit.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <Icon className="text-kc-lime" size={24} aria-hidden="true" />
                  <h2 className="mt-4 font-display text-xl font-bold text-kc-text">{benefit.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-kc-muted">{benefit.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="kc-shell py-16">
        <SectionIntro
          eyebrow={locale === "es" ? "Proceso" : "Process"}
          title={locale === "es" ? "Un proceso ordenado desde la idea hasta el lanzamiento internacional." : "A structured process from idea to international-ready launch."}
        />
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {data.process.map((step, index) => (
            <div key={step} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-kc-electric text-sm font-black text-white">{index + 1}</span>
              <h2 className="mt-4 text-sm font-bold leading-6 text-kc-text">{step}</h2>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.025]">
        <div className="kc-shell py-16">
          <SectionIntro
            eyebrow={locale === "es" ? "Preguntas frecuentes" : "Frequently asked questions"}
            title={locale === "es" ? "Sistemas adaptados a los procesos de cada negocio." : "Systems tailored to each business process."}
          />
          <div className="mt-8 grid gap-4">
            {data.faqs.map((faq) => (
              <article key={faq.question} className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="font-display text-xl font-bold text-kc-text">{faq.question}</h2>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-kc-muted sm:text-base">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CTASection {...cta(locale)} />
    </main>
  );
}

export function ProjectsView({ locale }: { locale: Locale }) {
  const copy = labels[locale];
  const data = getContent(locale);
  const projectsSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: locale === "es" ? "Proyectos de Ken Code" : "Ken Code projects",
    url: absoluteUrl(path(locale, "/proyectos", "/en/projects")),
    publisher: { "@type": "Organization", name: site.name },
    inLanguage: locale,
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={projectsSchema} />
      <PageHero
        eyebrow={locale === "es" ? "Proyectos" : "Projects"}
        title={locale === "es" ? "Casos reales para marcas que necesitaban una presencia digital más clara." : "Real case studies for brands that needed a clearer digital presence."}
        copy={locale === "es" ? "Cada proyecto combina diseño, estructura, rapidez e información accionable para resolver una meta concreta del negocio." : "Each project combines design, structure, speed and actionable information to solve a concrete business goal."}
        primaryLabel={locale === "es" ? "Cotizar un proyecto" : "Quote a project"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />
      <section className="kc-shell grid gap-5 py-12 md:grid-cols-2">
        {data.projects.map((project) => (
          <ProjectCard
            key={project.slug}
            {...project}
            caseHref={projectPath(locale, project.slug)}
            liveLabel={copy.live}
            caseLabel={copy.case}
          />
        ))}
      </section>
      <CTASection {...cta(locale)} />
    </main>
  );
}

export function PackagesView({ locale }: { locale: Locale }) {
  const data = getContent(locale);
  const packagesSchema = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: locale === "es" ? "Paquetes web de Ken Code" : "Ken Code website packages",
    provider: { "@type": "Organization", name: site.name },
    inLanguage: locale,
    itemListElement: data.packages.map((plan) => ({ "@type": "Offer", name: plan.name, description: plan.audience })),
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={packagesSchema} />
      <PageHero
        eyebrow={locale === "es" ? "Paquetes" : "Packages"}
        title={locale === "es" ? "Paquetes claros para negocios en diferentes etapas de crecimiento." : "Clear packages for businesses at different stages of growth."}
        copy={locale === "es" ? "Empieza con una landing enfocada o escala hacia una web completa, e-commerce o base lista para panel administrativo." : "Start with a focused landing page or scale into a complete business website, e-commerce experience or admin-ready foundation."}
        primaryLabel={locale === "es" ? "Solicitar cotización" : "Request a quote"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />
      <section className="kc-shell grid gap-5 py-12 lg:grid-cols-4">
        {data.packages.map((plan) => (
          <PackageCard
            key={plan.name}
            {...plan}
            quoteHref={path(locale, "/cotizar", "/en/quote")}
            quoteLabel={labels[locale].quotePackage}
          />
        ))}
      </section>
      <CTASection {...cta(locale)} />
    </main>
  );
}

export function ContactView({ locale }: { locale: Locale }) {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: locale === "es" ? "Contacto Ken Code" : "Contact Ken Code",
    url: absoluteUrl(path(locale, "/contacto", "/en/contact")),
    inLanguage: locale,
    about: { "@type": "ProfessionalService", name: site.name, email: site.email, telephone: site.phone, sameAs: [site.facebook, site.instagram] },
  };
  const contactItems = [
    {
      label: "WhatsApp",
      value: site.phone,
      href: whatsappLink(locale === "es" ? "Hola Ken Code. Quiero informacion para una solucion web profesional. Podemos trabajar de forma remota." : "Hello Ken Code. I want information about a professional web solution. We can work remotely."),
      icon: WhatsAppIcon,
    },
    { label: locale === "es" ? "Correo" : "Email", value: site.email, href: `mailto:${site.email}?subject=${locale === "es" ? "Cotizacion web Ken Code" : "Ken Code web quote"}`, icon: MailCheck },
    { label: "Facebook", value: locale === "es" ? "Ken Code en Facebook" : "Ken Code on Facebook", href: site.facebook, icon: Facebook },
    { label: "Instagram", value: "@kencodehn", href: site.instagram, icon: Instagram },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={contactSchema} />
      <PageHero
        eyebrow={locale === "es" ? "Contacto" : "Contact"}
        title={locale === "es" ? "Hablemos sobre la solucion digital que tu negocio necesita." : "Let's talk about the digital solution your business needs."}
        copy={locale === "es" ? "Puedes contactar a Ken Code por WhatsApp, correo o Facebook. Trabajamos de forma remota con negocios y fundadores de diferentes paises." : "You can reach Ken Code by WhatsApp, email or Facebook. We work remotely with businesses and founders in different countries."}
        primaryLabel={locale === "es" ? "Ver opciones de contacto" : "View contact options"}
        primaryHref="#contacto"
      />
      <section id="contacto" className="kc-shell grid min-w-0 grid-cols-[minmax(0,1fr)] scroll-mt-28 gap-8 py-12 sm:scroll-mt-32 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">
            {locale === "es" ? "Contacto directo" : "Direct contact"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-kc-muted">
            {locale === "es"
              ? "Usa el canal que prefieras. El formulario queda para solicitudes formales y seguimiento del futuro panel."
              : "Use the channel you prefer. The form is for formal requests and future panel follow-up."}
          </p>
          <div className="mt-6 grid gap-3">
          {contactItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex min-w-0 items-center gap-4 rounded-xl border border-white/10 bg-kc-bg/55 p-4 transition hover:border-kc-cyan/45"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-kc-turquoise/25 bg-kc-turquoise/10 text-kc-turquoise">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-kc-text">{item.label}</span>
                  <span className="block break-words text-sm leading-6 text-kc-muted">{item.value}</span>
                </span>
              </Link>
            );
          })}
          </div>
        </div>
        <QuoteForm locale={locale} />
      </section>
    </main>
  );
}

export function QuoteView({ locale }: { locale: Locale }) {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ContactPage", name: locale === "es" ? "Cotizar con Ken Code" : "Quote with Ken Code", url: absoluteUrl(path(locale, "/cotizar", "/en/quote")), inLanguage: locale }} />
      <PageHero
        eyebrow={locale === "es" ? "Cotizar" : "Quote"}
        title={locale === "es" ? "Cuentame que necesitas y preparo un camino claro." : "Tell me what you need and I will prepare a clear path."}
        copy={locale === "es" ? "Cuéntanos si necesitas una página web o un sistema administrativo, contable o de facturación, y qué procesos deseas controlar para preparar una propuesta adecuada." : "Tell us whether you need a website or an administrative, accounting or invoicing system, and which processes you want to manage so we can prepare the right proposal."}
        primaryLabel={locale === "es" ? "Enviar mensaje" : "Send message"}
        primaryHref="#formulario"
      />
      <section className="kc-shell grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 py-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">{locale === "es" ? "Antes de enviar" : "Before sending"}</h2>
          <p className="mt-4 text-sm leading-7 text-kc-muted">
            {locale === "es"
              ? "Incluye tu tipo de negocio, objetivo, procesos que deseas controlar, información disponible y fecha ideal de lanzamiento. Eso permite recomendar el alcance correcto."
              : "Include your business type, main goal, processes you want to manage, available information and ideal launch date. That makes it easier to recommend the right scope."}
          </p>
          <div className="mt-6 grid gap-3 text-sm font-semibold text-kc-muted">
            {(locale === "es" ? ["Páginas de aterrizaje", "Webs para negocios", "Tiendas en línea", "Sistemas administrativos, contables y facturación"] : ["Landing pages", "Business websites", "E-commerce", "Administrative, accounting and invoicing systems"]).map((item) => (
              <span key={item} className="rounded-lg border border-kc-border bg-kc-bg/70 px-4 py-3">{item}</span>
            ))}
          </div>
        </div>
        <div id="formulario" className="min-w-0 scroll-mt-28 sm:scroll-mt-32">
          <QuoteForm locale={locale} />
        </div>
      </section>
    </main>
  );
}

export function AboutView({ locale }: { locale: Locale }) {
  const data = getContent(locale);
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Person", "@id": `${site.url}#kenneth-duron`, name: "Kenneth Duron", alternateName: ["Kenneth Durón", "Kenneth Asael Duron Paz"], brand: site.name, url: absoluteUrl(path(locale, "/sobre-mi", "/en/about")), image: `${site.url}${site.portrait}`, sameAs: [site.facebook, site.instagram], jobTitle: locale === "es" ? "Desarrollador web" : "Web developer", worksFor: { "@type": "Organization", "@id": `${site.url}#organization`, name: site.name, url: site.url }, inLanguage: locale }} />
      <PageHero
        eyebrow={locale === "es" ? "Sobre mí" : "About"}
        title={locale === "es" ? "Construyo páginas web premium con estrategia de negocio y bases sólidas." : "I build premium websites with business strategy and solid foundations."}
        copy={locale === "es" ? "Ken Code ayuda a negocios, fundadores y marcas a trabajar con un estudio web moderno de forma remota, con comunicación clara y entrega lista para mercados internacionales." : "Ken Code helps businesses, founders and brands work with a modern web studio remotely, with clear communication and international-ready delivery."}
        primaryLabel={locale === "es" ? "Cotizar proyecto" : "Quote project"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />
      <section className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-kc-cyan/25 bg-kc-card">
          <Image
            src={site.portrait}
            alt={locale === "es" ? "Kenneth Duron, creador de Ken Code" : "Kenneth Duron, creator of Ken Code"}
            fill
            sizes="(max-width: 768px) 90vw, 360px"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-3xl font-black text-kc-text sm:text-4xl">{locale === "es" ? "Mi enfoque" : "My approach"}</h2>
          <p className="mt-5 text-base leading-8 text-kc-muted">
            {locale === "es"
              ? "Trato cada página como una herramienta de negocio: primero claridad, luego diseño, rapidez y preparación para buscadores. El objetivo es ayudar a que las personas entiendan, confíen y contacten desde cualquier lugar."
              : "I treat each website as a business tool: clarity first, then design, speed and search preparation. The goal is to help people understand, trust and contact from anywhere."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {data.strengths.map((item) => (
              <span key={item} className="rounded-lg border border-kc-border bg-kc-bg-soft/75 px-4 py-3 text-sm font-black text-kc-text">{item}</span>
            ))}
          </div>
        </div>
      </section>
      <CTASection {...cta(locale)} />
    </main>
  );
}

export function BlogView({ locale }: { locale: Locale }) {
  const data = getContent(locale);
  return (
    <main className="min-h-screen overflow-x-hidden">
      <PageHero
        eyebrow="Blog"
        title={locale === "es" ? "Recursos para negocios que quieren crecer con mejor estrategia digital." : "Resources for businesses that want to grow with better digital strategy."}
        copy={locale === "es" ? "Contenido útil sobre desarrollo web internacional, SEO local, landing pages, e-commerce y sitios para negocios." : "Useful content about international web development, local SEO, landing pages, e-commerce and business websites."}
        primaryLabel={locale === "es" ? "Cotizar proyecto" : "Quote project"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />
      <section className="kc-shell grid gap-4 py-12 md:grid-cols-3">
        {data.blogTopics.map((topic) => (
          <article key={topic} className="kc-card rounded-2xl p-6">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-kc-cyan">{locale === "es" ? "Tema SEO" : "SEO topic"}</p>
            <h2 className="mt-4 font-display text-2xl font-black leading-tight text-kc-text">{topic}</h2>
            <p className="mt-4 text-sm leading-7 text-kc-muted">
              {locale === "es" ? "Idea editorial para negocios que quieren tomar mejores decisiones digitales." : "Editorial idea for businesses that want to make better digital decisions."}
            </p>
          </article>
        ))}
      </section>
      <CTASection {...cta(locale)} />
    </main>
  );
}

export function ProjectDetailView({ locale, project }: { locale: Locale; project: Project }) {
  const copy = labels[locale];
  const gallery = project.gallery?.filter((item) => item.image && item.imageAlt) ?? [];
  const relatedServices = project.relatedServices?.filter((item) => item.href && item.label) ?? [];
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.name,
    url: absoluteUrl(projectPath(locale, project.slug)),
    creator: { "@type": "Organization", name: site.name },
    description: project.result,
    image: `${site.url}${project.image}`,
    inLanguage: locale,
  };

  return (
    <main className="min-h-screen overflow-x-hidden pt-28 sm:pt-32">
      <JsonLd data={schema} />
      <section className="kc-shell py-12">
        <Link href={path(locale, "/proyectos", "/en/projects")} className="inline-flex items-center gap-2 text-sm font-bold text-kc-cyan hover:text-kc-turquoise">
          <ArrowLeft size={16} aria-hidden="true" />
          {copy.backProjects}
        </Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.24em] text-kc-cyan">{project.category}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-black leading-tight text-kc-text sm:text-6xl">{project.name}</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">{project.description}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {project.externalUrl ? (
            <Link href={project.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-kc-electric px-6 py-3 text-sm font-black text-white transition hover:bg-kc-cyan hover:text-kc-bg">
              {copy.live}
              <ExternalLink size={18} aria-hidden="true" />
            </Link>
          ) : null}
          <Link href={path(locale, "/cotizar", "/en/quote")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-kc-border bg-white/5 px-6 py-3 text-sm font-bold text-kc-text transition hover:border-kc-turquoise hover:text-kc-turquoise">
            {locale === "es" ? "Quiero algo similar" : "I want something similar"}
            <MessageCircle size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="kc-shell py-8">
        <ScreenshotPanel image={project.image} imageAlt={project.imageAlt} />
      </section>

      {gallery.length > 0 ? (
        <section className="kc-shell grid gap-5 py-8 md:grid-cols-2">
          {gallery.map((item) => (
            <ScreenshotPanel key={item.image} image={item.image} imageAlt={item.imageAlt} />
          ))}
        </section>
      ) : null}

      <section className="kc-shell grid gap-5 py-8 lg:grid-cols-3">
        {[
          [copy.problem, project.problem],
          [copy.solution, project.solution],
          [copy.result, project.result],
        ].map(([title, text]) => (
          <article key={title} className="kc-card rounded-2xl p-6">
            <h2 className="font-display text-2xl font-black text-kc-text">{title}</h2>
            <p className="mt-4 text-sm leading-7 text-kc-muted">{text}</p>
          </article>
        ))}
      </section>

      <section className="kc-shell py-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="font-display text-2xl font-black text-kc-text">{copy.benefits}</h2>
            <BenefitList items={project.benefits} />
          </div>
          {relatedServices.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="font-display text-2xl font-black text-kc-text">{copy.appliedServices}</h2>
              <div className="mt-5 grid gap-3">
                {relatedServices.map((service) => (
                  <Link key={service.href} href={service.href} className="flex items-center justify-between gap-4 rounded-xl border border-kc-border bg-kc-bg/60 px-4 py-3 text-sm font-black text-kc-text transition hover:border-kc-cyan hover:text-kc-cyan">
                    {service.label}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <CTASection title={copy.projectCtaTitle} copy={copy.projectCtaCopy} href={path(locale, "/cotizar", "/en/quote")} label={locale === "es" ? "Cotizar proyecto" : "Quote project"} />
    </main>
  );
}
