import { ServicesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Desarrollo web y sistemas para negocios",
  description:
    "Desarrollo web y sistemas administrativos, contables y de facturacion con CRM, inventario y automatizacion para negocios.",
  path: "/servicios",
  keywords: ["servicios web Honduras", "sistemas administrativos", "sistemas contables en Honduras", "sistemas de facturacion", "CRM para empresas", "inventario y contabilidad"],
});

export default function ServicesPage() {
  return <ServicesView locale="es" />;
}
