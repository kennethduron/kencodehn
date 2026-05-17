import { ContactView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Contact",
  description:
    "Contact Ken Code by WhatsApp, email or Facebook to quote a professional website, landing page, e-commerce or remote digital solution.",
  path: "/en/contact",
  locale: "en",
  keywords: ["contact web developer", "quote website", "remote web studio", "Ken Code contact"],
});

export default function EnglishContactPage() {
  return <ContactView locale="en" />;
}
