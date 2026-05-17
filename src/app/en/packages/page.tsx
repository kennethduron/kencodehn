import { PackagesView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Website Packages",
  description:
    "Ken Code website packages for landing pages, business websites, Web Pro with admin foundation and e-commerce for local and international businesses.",
  path: "/en/packages",
  locale: "en",
  keywords: ["website packages", "landing page quote", "business website", "e-commerce development"],
});

export default function EnglishPackagesPage() {
  return <PackagesView locale="en" />;
}
