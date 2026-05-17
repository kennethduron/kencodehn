import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";

const siteUrl = "https://kencodehn.com";
const siteName = "Ken Code";
const title = "Ken Code | Sitios web profesionales que convierten";
const description =
  "Ken Code crea sitios web modernos, rápidos y enfocados en ventas para negocios que quieren verse más profesionales, recibir más cotizaciones y crecer en línea.";
const ogImage = "/images/logo-kenneth.jpg";
const favicon = "/images/fav-icon.jpg";

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
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  category: "Desarrollo web",
  keywords: [
    "Ken Code",
    "desarrollo web Honduras",
    "landing pages",
    "sitios web profesionales",
    "CRM",
    "e-commerce",
    "diseño web",
    "SEO básico",
    "Vercel",
    "Next.js",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: favicon, type: "image/jpeg" },
      { url: favicon, sizes: "32x32", type: "image/jpeg" },
      { url: favicon, sizes: "192x192", type: "image/jpeg" },
    ],
    shortcut: [{ url: favicon, type: "image/jpeg" }],
    apple: [{ url: favicon, sizes: "180x180", type: "image/jpeg" }],
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName,
    locale: "es_HN",
    type: "website",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Ken Code - Sitios web profesionales",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
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
      </body>
    </html>
  );
}
