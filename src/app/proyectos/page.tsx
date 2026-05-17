import { ProjectCard } from "@/components/site/cards";
import { CTASection } from "@/components/site/cta-section";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { projects } from "@/content/site-content";
import { absoluteUrl, createMetadata, site } from "@/lib/site";

export const metadata = createMetadata({
  title: "Proyectos web de Ken Code",
  description:
    "Explore Ken Code projects: digital menus, corporate websites, catalogs and conversion-focused web experiences for modern businesses.",
  path: "/proyectos",
  keywords: ["portafolio web Honduras", "proyectos web Honduras", "web development portfolio", "business website case studies"],
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
        title="Case studies for brands that needed a clearer digital presence."
        copy="Each project combines design, structure, speed and direct contact paths to solve a concrete business goal."
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
