import { ProjectsView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Proyectos web de Ken Code",
  description:
    "Proyectos reales de Ken Code con imágenes, resultados y enlaces externos: menús digitales, sitios de servicios, catálogos y experiencias web profesionales.",
  path: "/proyectos",
  keywords: ["portafolio web Honduras", "proyectos web Honduras", "casos de estudio web", "paginas web para negocios"],
});

export default function ProjectsPage() {
  return <ProjectsView locale="es" />;
}
