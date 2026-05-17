import { ServiceCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { SectionIntro } from "@/components/site/section-intro";
import { benefits, process, services } from "@/content/site-content";
import { createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "International Web Development Services",
  description:
    "Premium web development services by Ken Code: landing pages, business websites, e-commerce, lead systems, redesign, SEO and digital automation for global clients.",
  path: "/servicios",
  keywords: ["servicios web Honduras", "landing pages Honduras", "SEO básico Honduras", "international web development services", "remote software studio"],
});

const servicesSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Servicios de desarrollo web Ken Code",
  provider: {
    "@type": "ProfessionalService",
    name: site.name,
    url: site.url,
  },
  areaServed: ["Global", "United States", "Canada", "Europe", "Latin America", "Honduras"],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Servicios web",
    itemListElement: services.map((service) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: service.title,
        description: service.summary,
      },
    })),
  },
};

export default function ServicesPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={servicesSchema} />
      <PageHero
        eyebrow="Servicios"
        title="Complete web development for modern businesses and global brands."
        copy="From landing pages to e-commerce and future-ready CRM foundations, every service is designed for clarity, speed, conversion and remote collaboration."
      />

      <section className="kc-shell py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <ServiceCard key={service.slug} title={service.title} summary={service.detail} icon={service.icon} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025] py-16">
        <div className="kc-shell">
          <SectionIntro eyebrow="Beneficios" title="What a premium web presence brings to your business." />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => {
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
        <SectionIntro eyebrow="Proceso" title="A structured process from idea to international-ready launch." />
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {process.map((step, index) => (
            <div key={step} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-kc-electric text-sm font-black text-white">
                {index + 1}
              </span>
              <h2 className="mt-4 text-sm font-bold leading-6 text-kc-text">{step}</h2>
            </div>
          ))}
        </div>
      </section>

      <CTASection />
    </main>
  );
}
