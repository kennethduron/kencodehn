import { PackageCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { packages } from "@/content/site-content";
import { createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Paquetes de páginas web",
  description:
    "Paquetes de Ken Code para landing pages, sitios web business, Web Pro + CRM y e-commerce para negocios en Honduras.",
  path: "/paquetes",
  keywords: ["precios páginas web Honduras", "paquetes desarrollo web"],
});

const packagesSchema = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: "Paquetes de páginas web Ken Code",
  provider: {
    "@type": "Organization",
    name: site.name,
  },
  itemListElement: packages.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    description: plan.audience,
  })),
};

export default function PackagesPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={packagesSchema} />
      <PageHero
        eyebrow="Paquetes"
        title="Opciones claras según la etapa de tu negocio."
        copy="Puedes iniciar con una landing page y escalar hacia una web más completa, e-commerce o una base preparada para CRM privado futuro."
      />
      <section className="kc-shell grid gap-5 py-12 lg:grid-cols-4">
        {packages.map((plan) => (
          <PackageCard key={plan.name} {...plan} />
        ))}
      </section>
      <CTASection />
    </main>
  );
}
