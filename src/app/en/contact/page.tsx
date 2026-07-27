import { ContactView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Contact",
  description:
    "Contact Ken Code to quote websites, accounting systems, invoicing, CRM, automation or administrative modules for your business.",
  path: "/en/contact",
  locale: "en",
  keywords: ["contact web developer", "quote website", "accounting systems", "invoicing systems", "Ken Code contact"],
});

export default function EnglishContactPage() {
  return <ContactView locale="en" />;
}
