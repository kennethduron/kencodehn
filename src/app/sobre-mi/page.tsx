import Image from "next/image";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { techStack } from "@/content/site-content";
import { createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Sobre mí",
  description:
    "Conoce a Kenneth Durón, creador de Ken Code, desarrollador web enfocado en páginas profesionales, SEO técnico y sitios para negocios en Honduras.",
  path: "/sobre-mi",
  keywords: ["Kenneth Durón", "desarrollador web Honduras", "Ken Code"],
});

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Kenneth Durón",
  brand: site.name,
  url: `${site.url}/sobre-mi`,
  image: `${site.url}${site.portrait}`,
  sameAs: [site.facebook],
  jobTitle: "Desarrollador web",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={aboutSchema} />
      <PageHero
        eyebrow="Sobre mí"
        title="Construyo páginas web con criterio comercial y base técnica sólida."
        copy="Ken Code nace para ayudar a negocios a verse más profesionales, explicar mejor lo que venden y convertir visitas en conversaciones reales."
      />
      <section className="kc-shell grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-kc-cyan/25 bg-kc-card">
          <Image
            src={site.portrait}
            alt="Kenneth Durón, creador de Ken Code"
            fill
            sizes="(max-width: 768px) 90vw, 360px"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-3xl font-black text-kc-text sm:text-4xl">Mi enfoque</h2>
          <p className="mt-5 text-base leading-8 text-kc-muted">
            Trabajo cada web como una herramienta de ventas: primero claridad, después diseño, luego velocidad y SEO técnico. La meta es que el visitante entienda rápido, confíe y contacte.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <span key={tech} className="rounded-lg border border-kc-border bg-kc-bg-soft/75 px-4 py-3 text-sm font-black text-kc-text">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>
      <CTASection />
    </main>
  );
}
