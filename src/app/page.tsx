import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | Kenneth Duron - Desarrollo web en Honduras",
  description:
    "Ken Code es el estudio de desarrollo web de Kenneth Duron para paginas web profesionales, landing pages, e-commerce, CRM y soluciones digitales en Honduras e internacionalmente.",
  path: "/",
  keywords: ["Kenneth Duron", "Kenneth Asael Duron Paz", "Kencodehn", "Ken Code Honduras", "paginas web Kenneth Duron", "desarrollo web internacional"],
});

export default function Home() {
  return <HomeView locale="es" />;
}
