import { HomeView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code | International Web Development Studio",
  description:
    "Ken Code creates premium websites, landing pages, e-commerce and modern digital solutions for businesses that want to grow with an international presence.",
  path: "/en",
  locale: "en",
  keywords: ["international web development", "premium web studio", "business websites", "remote web developer"],
});

export default function EnglishHomePage() {
  return <HomeView locale="en" />;
}
