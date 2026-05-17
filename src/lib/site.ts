import type { Metadata } from "next";

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

export const seoKeywords = [
  "Ken Code",
  "desarrollo web internacional",
  "modern web development",
  "business websites",
  "professional web design",
  "remote web developer",
  "software studio",
  "web development studio",
  "landing pages",
  "e-commerce development",
  "CRM systems",
  "desarrollo web Honduras",
  "diseño web Honduras",
  "páginas web Honduras",
  "landing pages Honduras",
  "sitios web para negocios",
  "páginas web para restaurantes",
  "e-commerce Honduras",
  "CRM para negocios Honduras",
  "desarrollo web San Pedro Sula",
];

export function whatsappLink(message: string) {
  return `https://wa.me/${site.phoneRaw}?text=${encodeURIComponent(message)}`;
}

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}

type PageMetadata = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

export function createMetadata({ title, description, path, keywords = [] }: PageMetadata): Metadata {
  const canonical = absoluteUrl(path);
  const fullTitle = title.includes(site.name) ? title : `${title} | ${site.name}`;

  return {
    title: fullTitle,
    description,
    keywords: [...seoKeywords, ...keywords],
    alternates: {
      canonical,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: site.name,
      locale: "es_ES",
      type: "website",
      images: [
        {
          url: site.ogImage,
          width: 1200,
          height: 630,
          alt: "Ken Code - International web development studio",
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
