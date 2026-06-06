import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | Estudio internacional de desarrollo web",
  description:
    "Ken Code es un estudio internacional de desarrollo web que crea sitios profesionales, landing pages, ecommerce y sistemas CRM para negocios que quieren verse mas confiables, atraer clientes y crecer digitalmente.",
  path: "/",
  keywords: ["Kenneth Duron", "Kenneth Asael Duron Paz", "Ken Code Honduras", "paginas web Kenneth Duron", "desarrollo web internacional"],
});

export default function Home() {
  return <HomeView locale="es" />;
}
