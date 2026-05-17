import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { QuoteForm } from "@/components/site/quote-form";
import { createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Cotizar página web",
  description:
    "Quote a professional website or digital solution with Ken Code. Remote-ready form for landing pages, business websites, e-commerce and CRM-ready foundations.",
  path: "/cotizar",
  keywords: ["cotizar página web Honduras", "precio landing page Honduras", "quote website project", "remote web development"],
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
        title="Tell me what you need and I will prepare a clear path."
        copy="This form is ready for remote project inquiries. For now, it prepares a professional WhatsApp message before the CRM phase."
      />
      <section className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="font-display text-2xl font-black text-kc-text">Antes de enviar</h2>
          <p className="mt-4 text-sm leading-7 text-kc-muted">
            Include your business type, target market, main goal, available content and ideal launch date. That makes it easier to recommend the right path.
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
