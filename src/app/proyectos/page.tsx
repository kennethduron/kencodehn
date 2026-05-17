import { ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { projects } from "@/content/site-content";
import { absoluteUrl, createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Proyectos web de Ken Code",
  description:
    "Explora proyectos de Ken Code: menús digitales, sitios corporativos, catálogos web y experiencias enfocadas en cotizaciones para negocios.",
  path: "/proyectos",
  keywords: ["portafolio web Honduras", "proyectos web Honduras"],
});

const projectsSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Proyectos de Ken Code",
  url: absoluteUrl("/proyectos"),
  publisher: {
    "@type": "Organization",
    name: site.name,
  },
};

export default function ProjectsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={projectsSchema} />
      <PageHero
        eyebrow="Proyectos"
        title="Casos construidos para negocios que necesitaban una presencia más clara."
        copy="Cada proyecto combina diseño, estructura, velocidad y contacto directo para resolver una meta comercial concreta."
      />
      <section className="kc-shell grid gap-5 py-12 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.slug} {...project} />
        ))}
      </section>
      <CTASection />
    </main>
  );
}
