import { CTASection } from "@/components/site/cta-section";
import { PageHero } from "@/components/site/page-hero";
import { blogTopics } from "@/content/site-content";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Blog de diseño y desarrollo web",
  description:
    "Blog SEO futuro de Ken Code sobre desarrollo web Honduras, landing pages, páginas para negocios, e-commerce y SEO básico.",
  path: "/blog",
  keywords: ["blog desarrollo web Honduras", "consejos páginas web"],
});

export default function BlogPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <PageHero
        eyebrow="Blog"
        title="Recursos SEO para negocios que quieren vender mejor en línea."
        copy="Esta sección queda preparada para publicar contenido útil sobre páginas web, SEO local, landing pages y presencia digital."
      />
      <section className="kc-shell grid gap-4 py-12 md:grid-cols-3">
        {blogTopics.map((topic) => (
          <article key={topic} className="kc-card rounded-2xl p-6">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-kc-cyan">Próximamente</p>
            <h2 className="mt-4 font-display text-2xl font-black leading-tight text-kc-text">{topic}</h2>
            <p className="mt-4 text-sm leading-7 text-kc-muted">
              Artículo preparado para una fase futura de contenido SEO.
            </p>
          </article>
        ))}
      </section>
      <CTASection />
    </main>
  );
}
