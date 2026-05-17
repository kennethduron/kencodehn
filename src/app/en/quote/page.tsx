import { QuoteView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Quote a Website",
  description:
    "Quote a professional website with Ken Code. Form ready for remote landing page, business website, e-commerce and future admin panel projects.",
  path: "/en/quote",
  locale: "en",
  keywords: ["quote website", "website project quote", "remote web development", "professional business website"],
});

export default function EnglishQuotePage() {
  return <QuoteView locale="en" />;
}
