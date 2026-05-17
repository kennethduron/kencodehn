import { BlogView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Web Design and Development Blog",
  description:
    "Future Ken Code SEO blog about international web development, business websites, landing pages, e-commerce, local SEO and modern digital strategy.",
  path: "/en/blog",
  locale: "en",
  keywords: ["web development blog", "business website tips", "digital strategy", "SEO for businesses"],
});

export default function EnglishBlogPage() {
  return <BlogView locale="en" />;
}
