import { PackageCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { packages } from "@/content/site-content";
import { createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Website Packages for Modern Businesses",
  description:
    "Website packages by Ken Code for landing pages, business websites, Web Pro + CRM foundations and e-commerce projects for local and international businesses.",
  path: "/paquetes",
  keywords: ["precios páginas web Honduras", "paquetes desarrollo web", "website packages", "business websites", "e-commerce development"],
});

const packagesSchema = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: "Ken Code website packages",
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
        title="Clear packages for businesses at different stages of growth."
        copy="Start with a focused landing page or scale into a complete business website, e-commerce experience or CRM-ready foundation."
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
