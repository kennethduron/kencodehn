import { ServicesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Web Development Services",
  description:
    "Ken Code services for landing pages, business websites, e-commerce, future admin panels, basic SEO and WhatsApp contact for local and international clients.",
  path: "/en/services",
  locale: "en",
  keywords: ["web development services", "business websites", "landing pages", "international web studio"],
});

export default function EnglishServicesPage() {
  return <ServicesView locale="en" />;
}
