import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "KenCode | Web Development and Business Systems",
  description:
    "KenCode builds websites, accounting and invoicing systems, CRM and automation that connect sales, inventory, customers and financial operations.",
  path: "/en",
  locale: "en",
  keywords: ["international web development", "business websites", "accounting systems", "invoicing systems", "business software"],
});

export default function EnglishHomePage() {
  return <HomeView locale="en" />;
}
