import { CTASection } from "@/components/site/cta-section";
import { PageHero } from "@/components/site/page-hero";
import { blogTopics } from "@/content/site-content";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Blog de diseño y desarrollo web",
  description:
    "Future Ken Code SEO blog about international web development, business websites, landing pages, e-commerce, local SEO and modern digital strategy.",
  path: "/blog",
  keywords: ["blog desarrollo web Honduras", "consejos páginas web", "international web development blog", "business website strategy"],
});

export default function BlogPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <PageHero
        eyebrow="Blog"
        title="Resources for businesses that want to grow with better digital strategy."
        copy="This section is prepared for useful content about international web development, local SEO, landing pages, e-commerce and business websites."
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
