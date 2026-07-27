import { QuoteView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Cotizar solucion digital",
  description:
    "Cotiza con Ken Code una pagina web, sistema contable, facturacion, CRM o modulo administrativo adaptado a los procesos de tu negocio.",
  path: "/cotizar",
  keywords: ["cotizar pagina web Honduras", "cotizar sistema contable", "sistema de facturacion", "cotizacion desarrollo web", "software para negocios"],
});

export default function QuotePage() {
  return <QuoteView locale="es" />;
}
