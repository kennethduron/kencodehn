import { PackagesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Paquetes web",
  description:
    "Paquetes de Ken Code para landing pages, sitios web business, web pro con base para panel y e-commerce para negocios locales e internacionales.",
  path: "/paquetes",
  keywords: ["paquetes desarrollo web", "precios paginas web Honduras", "landing page Honduras", "e-commerce Honduras"],
});

export default function PackagesPage() {
  return <PackagesView locale="es" />;
}
