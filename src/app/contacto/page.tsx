import { ContactView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Contacto",
  description:
    "Contacta a KenCode para cotizar paginas web, sistemas contables, facturacion, CRM, automatizacion o modulos administrativos para tu negocio.",
  path: "/contacto",
  keywords: ["contacto desarrollo web Honduras", "cotizar pagina web Honduras", "sistemas contables Honduras", "sistemas de facturacion", "KenCode contacto"],
});

export default function ContactPage() {
  return <ContactView locale="es" />;
}
