import { QuoteView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Cotizar pagina web",
  description:
    "Cotiza una pagina web profesional con Ken Code. Formulario listo para proyectos remotos de landing pages, sitios web, e-commerce y panel administrativo futuro.",
  path: "/cotizar",
  keywords: ["cotizar pagina web Honduras", "precio landing page Honduras", "cotizacion desarrollo web", "pagina web profesional"],
});

export default function QuotePage() {
  return <QuoteView locale="es" />;
}
