import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | Web Development and Business Systems",
  description:
    "Ken Code builds websites, accounting and invoicing systems, CRM and automation that connect sales, inventory, customers and financial operations.",
  path: "/en",
  locale: "en",
  keywords: ["international web development", "business websites", "accounting systems", "invoicing systems", "business software"],
});

export default function EnglishHomePage() {
  return <HomeView locale="en" />;
}
