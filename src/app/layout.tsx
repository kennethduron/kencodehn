import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/site/footer";
import { FloatingContact } from "@/components/site/floating-contact";
import { Header } from "@/components/site/header";
import { site, seoKeywords } from "@/lib/site";

const title = "Ken Code | Estudio internacional de desarrollo web";
const description =
  "Ken Code crea paginas web premium, landing pages, e-commerce y soluciones digitales modernas para negocios que trabajan localmente e internacionalmente.";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title,
  description,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  category: "Desarrollo web",
  keywords: seoKeywords,
  alternates: {
    canonical: "/",
    languages: {
      es: "/",
      en: "/en",
      "x-default": "/",
    },
  },
  icons: {
    icon: [
      { url: site.favicon, type: "image/jpeg" },
      { url: site.favicon, sizes: "32x32", type: "image/jpeg" },
      { url: site.favicon, sizes: "192x192", type: "image/jpeg" },
    ],
    shortcut: [{ url: site.favicon, type: "image/jpeg" }],
    apple: [{ url: site.favicon, sizes: "180x180", type: "image/jpeg" }],
  },
  openGraph: {
    title,
    description,
    url: site.url,
    siteName: site.name,
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: `${site.url}${site.ogImage}`,
        width: 785,
        height: 981,
        alt: "Ken Code - Estudio internacional de desarrollo web",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [
      {
        url: `${site.url}${site.ogImage}`,
        width: 785,
        height: 981,
        alt: "Ken Code - Estudio internacional de desarrollo web",
        type: "image/jpeg",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <div className="pointer-events-none fixed inset-0 -z-10 kc-grid-bg" />
        <Header />
        {children}
        <Footer />
        <FloatingContact />
      </body>
    </html>
  );
}
