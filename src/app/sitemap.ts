import type { MetadataRoute } from "next";
import { projects } from "@/content/site-content";
import { seoServices } from "@/content/seo-services";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const staticRoutes = [
    { es: "/", en: "/en", priority: 1 },
    { es: "/servicios", en: "/en/services", priority: 0.9 },
    { es: "/proyectos", en: "/en/projects", priority: 0.9 },
    { es: "/paquetes", en: "/en/packages", priority: 0.85 },
    { es: "/contacto", en: "/en/contact", priority: 0.85 },
    { es: "/cotizar", en: "/en/quote", priority: 0.8 },
    { es: "/sobre-mi", en: "/en/about", priority: 0.65 },
    { es: "/blog", en: "/en/blog", priority: 0.55 },
  ];

  const routeEntries = staticRoutes.flatMap((route) => [
    {
      url: absoluteUrl(route.es),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: route.priority,
      alternates: {
        languages: {
          es: absoluteUrl(route.es),
          en: absoluteUrl(route.en),
          "x-default": absoluteUrl(route.es),
        },
      },
    },
    {
      url: absoluteUrl(route.en),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: route.priority - 0.05,
      alternates: {
        languages: {
          es: absoluteUrl(route.es),
          en: absoluteUrl(route.en),
          "x-default": absoluteUrl(route.es),
        },
      },
    },
  ]);

  const projectEntries = projects.flatMap((project) => {
    const es = `/proyectos/${project.slug}`;
    const en = `/en/projects/${project.slug}`;

    return [
      {
        url: absoluteUrl(es),
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates: {
          languages: {
            es: absoluteUrl(es),
            en: absoluteUrl(en),
            "x-default": absoluteUrl(es),
          },
        },
      },
      {
        url: absoluteUrl(en),
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.65,
        alternates: {
          languages: {
            es: absoluteUrl(es),
            en: absoluteUrl(en),
            "x-default": absoluteUrl(es),
          },
        },
      },
    ];
  });

  const serviceEntries = seoServices.map((service) => ({
    url: absoluteUrl(`/servicios/${service.slug}`),
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.82,
  }));

  return [...routeEntries, ...serviceEntries, ...projectEntries];
}
