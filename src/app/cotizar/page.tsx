import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { QuoteForm } from "@/components/site/quote-form";
import { createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Cotizar página web",
  description:
    "Cotiza una página web profesional con Ken Code. Formulario avanzado para landing pages, sitios web business, e-commerce o bases listas para CRM futuro.",
  path: "/cotizar",
  keywords: ["cotizar página web Honduras", "precio landing page Honduras"],
});

const quoteSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Cotizar con Ken Code",
  url: `${site.url}/cotizar`,
};

export default function QuotePage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={quoteSchema} />
      <PageHero
        eyebrow="Cotizar"
        title="Cuéntame qué necesitas y preparo una ruta clara."
        copy="Este formulario todavía no se conecta al CRM. Por ahora prepara un mensaje profesional para enviarlo directo por WhatsApp."
      />
      <section className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">Antes de enviar</h2>
          <p className="mt-4 text-sm leading-7 text-kc-muted">
            Incluye el tipo de negocio, el objetivo principal, si ya tienes logo/contenido y una fecha tentativa de lanzamiento. Con eso puedo responderte mejor.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-semibold text-kc-muted">
            <span className="rounded-lg border border-kc-border bg-kc-bg/70 px-4 py-3">Landing pages</span>
            <span className="rounded-lg border border-kc-border bg-kc-bg/70 px-4 py-3">Webs para negocios</span>
            <span className="rounded-lg border border-kc-border bg-kc-bg/70 px-4 py-3">E-commerce</span>
            <span className="rounded-lg border border-kc-border bg-kc-bg/70 px-4 py-3">Base para CRM futuro</span>
          </div>
        </div>
        <QuoteForm />
      </section>
    </main>
  );
}
