import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const privateRoutes = ["/admin", "/admin/", "/api", "/api/"];
const allowedCrawlers = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "WhatsApp",
  "Slackbot",
  "TelegramBot",
  "Googlebot",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privateRoutes,
      },
      ...allowedCrawlers.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: privateRoutes,
      })),
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
