import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ken Code CRM",
    short_name: "Ken Code CRM",
    description: "Aplicación comercial y operativa de Ken Code.",
    start_url: "/admin",
    id: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6fb",
    theme_color: "#14243d",
    lang: "es-HN",
    icons: [
      {
        src: "/images/fav-icon.jpg",
        sizes: "716x716",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
