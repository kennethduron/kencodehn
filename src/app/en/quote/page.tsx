import { QuoteView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Quote a Digital Solution",
  description:
    "Request a quote from KenCode for a website, accounting system, invoicing, CRM or administrative module tailored to your business processes.",
  path: "/en/quote",
  locale: "en",
  keywords: ["quote website", "accounting system quote", "invoicing system", "business software", "remote web development"],
});

export default function EnglishQuotePage() {
  return <QuoteView locale="en" />;
}
