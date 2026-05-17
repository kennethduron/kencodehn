import { AboutView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Sobre mi",
  description:
    "Conoce a Kenneth Duron, creador de Ken Code, estudio web premium que desarrolla paginas modernas, SEO-ready y soluciones digitales para clientes internacionales.",
  path: "/sobre-mi",
  keywords: ["Kenneth Duron", "desarrollador web Honduras", "Ken Code", "desarrollador web remoto", "estudio web internacional"],
});

export default function AboutPage() {
  return <AboutView locale="es" />;
}
