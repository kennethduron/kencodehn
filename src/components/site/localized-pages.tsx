import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Facebook, MailCheck, MessageCircle } from "lucide-react";
import { BenefitList, PackageCard, ProjectCard, ScreenshotPanel, ServiceCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionIntro } from "@/components/site/section-intro";
import { SocialLinks } from "@/components/site/social-links";
import { getContent, type Project } from "@/content/site-content";
import { absoluteAssetUrl, absoluteUrl, site, whatsappLink, type Locale } from "@/lib/site";
import { QuoteForm } from "./quote-form";

const labels = {
  es: {
    heroEyebrow: "Estudio web y software internacional",
    heroTitle: "Paginas web premium para negocios modernos que quieren crecer",
    heroCopy:
      "Ken Code crea experiencias web modernas para empresas, marcas y emprendedores que trabajan localmente o de forma remota con clientes de cualquier parte del mundo.",
    quote: "Solicitar cotizacion",
    projects: "Ver proyectos",
    photoCaption: "Experiencias digitales listas para vender, contactar y crecer en diferentes mercados.",
    servicesTitle: "Soluciones digitales para negocios que necesitan una presencia mas fuerte.",
    servicesCopy: "Paginas rapidas, responsive y enfocadas en conversion para clientes locales e internacionales.",
    allServices: "Ver todos los servicios",
    selectedWork: "Proyectos reales creados con objetivos de negocio.",
    selectedWorkCopy: "Cada proyecto mejora claridad, confianza y el camino del visitante hacia una conversacion calificada.",
    benefitsTitle: "Una presencia web pensada para crecer, no solo para estar en internet.",
    testimonialsTitle: "Clientes construyendo una presencia digital mas fuerte.",
    whatsappMessage: "Hola Ken Code. Quiero cotizar una solucion web profesional para mi negocio. Podemos trabajar de forma remota.",
    whatsappLabel: "Cotizar proyecto",
    live: "Ver proyecto",
    case: "Ver caso de estudio",
    pending: "Link pendiente",
    backProjects: "Volver a proyectos",
    problem: "Problema",
    solution: "Solucion",
    result: "Resultado",
    benefits: "Beneficios",
    screenshot: "Vista del proyecto",
    projectCtaTitle: "Quieres una web con este nivel de claridad?",
    projectCtaCopy: "Ken Code puede trabajar de forma remota con tu negocio para crear una experiencia web premium lista para clientes internacionales.",
    quotePackage: "Cotizar paquete",
  },
  en: {
    heroEyebrow: "International web and software studio",
    heroTitle: "Premium websites for modern businesses ready to grow",
    heroCopy:
      "Ken Code creates modern web experiences for companies, brands and founders working locally or remotely with clients around the world.",
    quote: "Request a quote",
    projects: "View projects",
    photoCaption: "Digital experiences ready to sell, connect and grow across markets.",
    servicesTitle: "Digital solutions for businesses that need a stronger presence.",
    servicesCopy: "Fast, responsive and conversion-focused websites for local and international clients.",
    allServices: "View all services",
    selectedWork: "Real projects built around business goals.",
    selectedWorkCopy: "Each project improves clarity, trust and the path from visitor to qualified conversation.",
    benefitsTitle: "A web presence built for growth, not just for being online.",
    testimonialsTitle: "Clients building a stronger digital presence.",
    whatsappMessage: "Hello Ken Code. I want to quote a professional web solution for my business. We can work remotely.",
    whatsappLabel: "Quote project",
    live: "View project",
    case: "View case study",
    pending: "Link pending",
    backProjects: "Back to projects",
    problem: "Problem",
    solution: "Solution",
    result: "Result",
    benefits: "Benefits",
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
    "@type": "ProfessionalService",
    name: site.name,
    url: site.url,
    image: absoluteAssetUrl(site.ogImage),
    logo: absoluteAssetUrl(site.favicon),
    email: site.email,
    telephone: site.phone,
    areaServed: ["Global", "United States", "Canada", "Europe", "Latin America", "Honduras"],
    sameAs: [site.facebook],
    makesOffer: data.services.map((service) => service.title),
    inLanguage: locale,
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={homeSchema} />
      <section className="relative overflow-hidden pt-28 sm:pt-32">
        <div className="absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,0.22),transparent_34rem)]" />
        <div className="kc-shell grid min-h-[calc(100vh-5rem)] items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-14">
          <Reveal>
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-kc-cyan/30 bg-kc-cyan/10 px-4 py-2 text-sm font-bold text-kc-cyan shadow-[0_0_30px_rgba(0,217,255,0.14)]">
                {copy.heroEyebrow}
              </p>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-black leading-[1.04] text-kc-text sm:text-5xl lg:text-7xl">
                {copy.heroTitle}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-kc-muted sm:text-lg">{copy.heroCopy}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

          <Reveal className="relative">
            <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-kc-cyan/25 bg-kc-card p-3 shadow-[0_0_90px_rgba(0,217,255,0.16)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
                <Image
                  src={site.portrait}
                  alt={locale === "es" ? "Kenneth Duron, desarrollador web de Ken Code" : "Kenneth Duron, web developer at Ken Code"}
                  fill
                  priority
                  sizes="(max-width: 768px) 90vw, 420px"
                  className="object-cover"
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
                unavailableLabel={copy.pending}
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
    name: locale === "es" ? "Servicios de desarrollo web Ken Code" : "Ken Code web development services",
    provider: { "@type": "ProfessionalService", name: site.name, url: site.url },
    areaServed: ["Global", "United States", "Canada", "Europe", "Latin America", "Honduras"],
    inLanguage: locale,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: locale === "es" ? "Servicios web" : "Web services",
      itemListElement: data.services.map((service) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: service.title, description: service.summary },
      })),
    },
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={servicesSchema} />
      <PageHero
        eyebrow={locale === "es" ? "Servicios" : "Services"}
        title={locale === "es" ? "Desarrollo web completo para negocios modernos y marcas globales." : "Complete web development for modern businesses and global brands."}
        copy={locale === "es" ? "Desde landing pages hasta e-commerce y bases listas para panel administrativo, cada servicio se disena para claridad, rapidez, conversion y colaboracion remota." : "From landing pages to e-commerce and future-ready admin foundations, every service is designed for clarity, speed, conversion and remote collaboration."}
        primaryLabel={locale === "es" ? "Solicitar cotizacion" : "Request a quote"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />

      <section className="kc-shell py-12">
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
        title={locale === "es" ? "Casos reales para marcas que necesitaban una presencia digital mas clara." : "Real case studies for brands that needed a clearer digital presence."}
        copy={locale === "es" ? "Cada proyecto combina diseno, estructura, rapidez e informacion accionable para resolver una meta concreta del negocio." : "Each project combines design, structure, speed and actionable information to solve a concrete business goal."}
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
            unavailableLabel={copy.pending}
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
        primaryLabel={locale === "es" ? "Solicitar cotizacion" : "Request a quote"}
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
    about: { "@type": "ProfessionalService", name: site.name, email: site.email, telephone: site.phone },
  };
  const contactItems = [
    {
      label: "WhatsApp",
      value: site.phone,
      href: whatsappLink(locale === "es" ? "Hola Ken Code. Quiero informacion para una solucion web profesional. Podemos trabajar de forma remota." : "Hello Ken Code. I want information about a professional web solution. We can work remotely."),
      icon: MessageCircle,
    },
    { label: locale === "es" ? "Correo" : "Email", value: site.email, href: `mailto:${site.email}?subject=${locale === "es" ? "Cotizacion web Ken Code" : "Ken Code web quote"}`, icon: MailCheck },
    { label: "Facebook", value: locale === "es" ? "Ken Code en Facebook" : "Ken Code on Facebook", href: site.facebook, icon: Facebook },
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
      <section id="contacto" className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">
            {locale === "es" ? "Contacto directo" : "Direct contact"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-kc-muted">
            {locale === "es"
              ? "Usa el canal que prefieras. El formulario queda para solicitudes formales y seguimiento del futuro panel."
              : "Use the channel you prefer. The form is for formal requests and future panel follow-up."}
          </p>
          <SocialLinks
            className="mt-5"
            whatsappMessage={
              locale === "es"
                ? "Hola Ken Code. Quiero informacion para una solucion web profesional. Podemos trabajar de forma remota."
                : "Hello Ken Code. I want information about a professional web solution. We can work remotely."
            }
          />
          <div className="mt-6 grid gap-3">
          {contactItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-kc-bg/55 p-4 transition hover:border-kc-cyan/45"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-kc-turquoise/25 bg-kc-turquoise/10 text-kc-turquoise">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-black text-kc-text">{item.label}</span>
                  <span className="block text-sm leading-6 text-kc-muted">{item.value}</span>
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
        copy={locale === "es" ? "Este formulario envia tu solicitud al flujo interno de leads y queda preparado para el futuro panel administrativo." : "This form sends your request into the internal lead flow and is prepared for the future admin panel."}
        primaryLabel={locale === "es" ? "Enviar mensaje" : "Send message"}
        primaryHref="#formulario"
      />
      <section id="formulario" className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">{locale === "es" ? "Antes de enviar" : "Before sending"}</h2>
          <p className="mt-4 text-sm leading-7 text-kc-muted">
            {locale === "es"
              ? "Incluye tu tipo de negocio, mercado objetivo, meta principal, contenido disponible y fecha ideal de lanzamiento. Eso permite recomendar el camino correcto."
              : "Include your business type, target market, main goal, available content and ideal launch date. That makes it easier to recommend the right path."}
          </p>
          <div className="mt-6 grid gap-3 text-sm font-semibold text-kc-muted">
            {(locale === "es" ? ["Paginas de aterrizaje", "Webs para negocios", "Tiendas en linea", "Base para panel futuro"] : ["Landing pages", "Business websites", "E-commerce", "Future panel foundation"]).map((item) => (
              <span key={item} className="rounded-lg border border-kc-border bg-kc-bg/70 px-4 py-3">{item}</span>
            ))}
          </div>
        </div>
        <QuoteForm locale={locale} />
      </section>
    </main>
  );
}

export function AboutView({ locale }: { locale: Locale }) {
  const data = getContent(locale);
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Person", name: "Kenneth Duron", brand: site.name, url: absoluteUrl(path(locale, "/sobre-mi", "/en/about")), image: `${site.url}${site.portrait}`, sameAs: [site.facebook], jobTitle: locale === "es" ? "Desarrollador web" : "Web developer", worksFor: { "@type": "Organization", name: site.name, url: site.url }, inLanguage: locale }} />
      <PageHero
        eyebrow={locale === "es" ? "Sobre mi" : "About"}
        title={locale === "es" ? "Construyo paginas web premium con estrategia de negocio y bases solidas." : "I build premium websites with business strategy and solid foundations."}
        copy={locale === "es" ? "Ken Code ayuda a negocios, fundadores y marcas a trabajar con un estudio web moderno de forma remota, con comunicacion clara y entrega lista para mercados internacionales." : "Ken Code helps businesses, founders and brands work with a modern web studio remotely, with clear communication and international-ready delivery."}
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
              ? "Trato cada pagina como una herramienta de negocio: primero claridad, luego diseno, rapidez y preparacion para buscadores. El objetivo es ayudar a que las personas entiendan, confien y contacten desde cualquier lugar."
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
        copy={locale === "es" ? "Esta seccion queda preparada para contenido util sobre desarrollo web internacional, SEO local, landing pages, e-commerce y sitios para negocios." : "This section is prepared for useful content about international web development, local SEO, landing pages, e-commerce and business websites."}
        primaryLabel={locale === "es" ? "Cotizar proyecto" : "Quote project"}
        primaryHref={path(locale, "/cotizar", "/en/quote")}
      />
      <section className="kc-shell grid gap-4 py-12 md:grid-cols-3">
        {data.blogTopics.map((topic) => (
          <article key={topic} className="kc-card rounded-2xl p-6">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-kc-cyan">{locale === "es" ? "Proximamente" : "Coming soon"}</p>
            <h2 className="mt-4 font-display text-2xl font-black leading-tight text-kc-text">{topic}</h2>
            <p className="mt-4 text-sm leading-7 text-kc-muted">
              {locale === "es" ? "Articulo preparado para una fase futura de contenido SEO." : "Article prepared for a future SEO content phase."}
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">{copy.benefits}</h2>
          <BenefitList items={project.benefits} />
        </div>
      </section>

      <CTASection title={copy.projectCtaTitle} copy={copy.projectCtaCopy} href={path(locale, "/cotizar", "/en/quote")} label={locale === "es" ? "Cotizar proyecto" : "Quote project"} />
    </main>
  );
}
