import type { Metadata } from "next";

export type Locale = "es" | "en";

export const site = {
  name: "Ken Code",
  url: "https://kencodehn.com",
  domain: "kencodehn.com",
  email: "kencodehn@gmail.com",
  phone: "+504 9911-2211",
  phoneRaw: "50499112211",
  facebook: "https://www.facebook.com/share/1CMt5EQ8Jo/?mibextid=wwXIfr",
  ogImage: "/images/logo-kenneth.jpg",
  favicon: "/images/fav-icon.jpg",
  portrait: "/images/kenneth.jpg",
};

export const routes = [
  { es: "/", en: "/en" },
  { es: "/servicios", en: "/en/services" },
  { es: "/proyectos", en: "/en/projects" },
  { es: "/paquetes", en: "/en/packages" },
  { es: "/contacto", en: "/en/contact" },
  { es: "/cotizar", en: "/en/quote" },
  { es: "/sobre-mi", en: "/en/about" },
  { es: "/blog", en: "/en/blog" },
] as const;

export const seoKeywordsEs = [
  "Ken Code",
  "desarrollo web internacional",
  "landing pages",
  "sitios web profesionales",
  "diseno web profesional",
  "estudio web premium",
  "software studio internacional",
  "trabajo remoto",
  "clientes internacionales",
  "desarrollo web Honduras",
  "diseno web Honduras",
  "paginas web Honduras",
  "landing pages Honduras",
  "sitios web para negocios",
  "paginas web para restaurantes",
  "e-commerce Honduras",
  "CRM para negocios Honduras",
  "desarrollo web San Pedro Sula",
];

export const seoKeywordsEn = [
  "Ken Code",
  "international web development",
  "modern web development",
  "business websites",
  "professional web design",
  "remote web developer",
  "premium web studio",
  "software studio",
  "landing pages",
  "e-commerce development",
  "CRM systems",
  "web development Honduras",
  "Latin America web studio",
];

export const seoKeywords = seoKeywordsEs;

export function whatsappLink(message: string) {
  return `https://wa.me/${site.phoneRaw}?text=${encodeURIComponent(message)}`;
}

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}

export function getAlternatePath(path: string, locale: Locale): string {
  const staticRoute = routes.find((route) => route[locale] === path);
  if (staticRoute) {
    return locale === "es" ? staticRoute.en : staticRoute.es;
  }

  if (locale === "es" && path.startsWith("/proyectos/")) {
    return path.replace("/proyectos/", "/en/projects/");
  }

  if (locale === "en" && path.startsWith("/en/projects/")) {
    return path.replace("/en/projects/", "/proyectos/");
  }

  return locale === "es" ? "/en" : "/";
}

type PageMetadata = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  locale?: Locale;
  alternatePath?: string;
};

export function createMetadata({
  title,
  description,
  path,
  keywords = [],
  locale = "es",
  alternatePath,
}: PageMetadata): Metadata {
  const canonical = absoluteUrl(path);
  const fullTitle = title.includes(site.name) ? title : `${title} | ${site.name}`;
  const resolvedAlternatePath = alternatePath ?? getAlternatePath(path, locale);
  const esPath = locale === "es" ? path : resolvedAlternatePath;
  const enPath = locale === "en" ? path : resolvedAlternatePath;
  const keywordBase = locale === "es" ? seoKeywordsEs : seoKeywordsEn;
  const ogAlt =
    locale === "es"
      ? "Ken Code - Estudio internacional de desarrollo web"
      : "Ken Code - International web development studio";

  return {
    title: fullTitle,
    description,
    keywords: [...keywordBase, ...keywords],
    alternates: {
      canonical,
      languages: {
        es: absoluteUrl(esPath),
        en: absoluteUrl(enPath),
        "x-default": absoluteUrl(esPath),
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: site.name,
      locale: locale === "es" ? "es_ES" : "en_US",
      alternateLocale: [locale === "es" ? "en_US" : "es_ES"],
      type: "website",
      images: [
        {
          url: site.ogImage,
          width: 1200,
          height: 630,
          alt: ogAlt,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [site.ogImage],
    },
  };
}
