import type { MetadataRoute } from "next";
import { projects } from "@/content/site-content";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticRoutes = [
    { path: "/", priority: 1 },
    { path: "/servicios", priority: 0.9 },
    { path: "/proyectos", priority: 0.9 },
    { path: "/paquetes", priority: 0.85 },
    { path: "/contacto", priority: 0.85 },
    { path: "/cotizar", priority: 0.8 },
    { path: "/sobre-mi", priority: 0.65 },
    { path: "/blog", priority: 0.55 },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: route.priority,
    })),
    ...projects.map((project) => ({
      url: absoluteUrl(`/proyectos/${project.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
