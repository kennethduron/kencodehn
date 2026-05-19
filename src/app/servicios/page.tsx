import { ServicesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Servicios de desarrollo web",
  description:
    "Servicios de Ken Code para paginas web en Honduras, landing pages, e-commerce, CRM, restaurantes, negocios locales y desarrollo web internacional.",
  path: "/servicios",
  keywords: ["servicios web Honduras", "landing pages Honduras", "ecommerce Honduras", "CRM para empresas", "paginas web para restaurantes"],
});

export default function ServicesPage() {
  return <ServicesView locale="es" />;
}
