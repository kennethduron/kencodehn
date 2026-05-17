import { ContactView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Contacto",
  description:
    "Contacta a Ken Code por WhatsApp, correo o Facebook para cotizar una pagina web profesional, landing page, e-commerce o solucion digital remota.",
  path: "/contacto",
  keywords: ["contacto desarrollo web Honduras", "cotizar pagina web Honduras", "desarrollo web remoto", "Ken Code contacto"],
});

export default function ContactPage() {
  return <ContactView locale="es" />;
}
