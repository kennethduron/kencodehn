import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | Estudio internacional de desarrollo web",
  description:
    "Ken Code crea paginas web premium, landing pages, e-commerce y soluciones digitales para negocios que quieren crecer con una presencia moderna e internacional.",
  path: "/",
  keywords: ["paginas web profesionales", "diseno web para negocios", "desarrollo web internacional", "estudio web remoto"],
});

export default function Home() {
  return <HomeView locale="es" />;
}
