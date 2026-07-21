import { ContactView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Contact",
  description:
    "Contact KenCode to quote websites, accounting systems, invoicing, CRM, automation or administrative modules for your business.",
  path: "/en/contact",
  locale: "en",
  keywords: ["contact web developer", "quote website", "accounting systems", "invoicing systems", "KenCode contact"],
});

export default function EnglishContactPage() {
  return <ContactView locale="en" />;
}
