import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | Desarrollo web y sistemas para negocios",
  description:
    "Ken Code desarrolla paginas web, sistemas contables y de facturacion, CRM y automatizaciones que conectan ventas, inventario, clientes y finanzas.",
  path: "/",
  keywords: ["Kenneth Duron", "Kenneth Asael Duron Paz", "Ken Code Honduras", "paginas web Kenneth Duron", "sistemas contables en Honduras", "sistemas de facturacion"],
});

export default function Home() {
  return <HomeView locale="es" />;
}
