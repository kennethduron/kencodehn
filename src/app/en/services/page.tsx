import { ServicesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Web Development and Business Systems",
  description:
    "Web development and administrative, accounting and invoicing systems with CRM, inventory and automation for businesses.",
  path: "/en/services",
  locale: "en",
  keywords: ["web development services", "administrative systems", "accounting systems", "invoicing systems", "business software", "inventory and accounting"],
});

export default function EnglishServicesPage() {
  return <ServicesView locale="en" />;
}
