import { ServicesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Servicios de desarrollo web",
  description:
    "Servicios de Ken Code para landing pages, sitios web de negocios, e-commerce, panel administrativo futuro, SEO basico y contacto por WhatsApp para clientes locales e internacionales.",
  path: "/servicios",
  keywords: ["servicios web Honduras", "landing pages Honduras", "desarrollo web internacional", "sitios web para negocios"],
});

export default function ServicesPage() {
  return <ServicesView locale="es" />;
}
