import { BlogView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Blog de diseño y desarrollo web",
  description:
    "Blog SEO futuro de Ken Code sobre desarrollo web internacional, sitios para negocios, landing pages, e-commerce, SEO local y estrategia digital moderna.",
  path: "/blog",
  keywords: ["blog desarrollo web Honduras", "consejos paginas web", "estrategia digital", "SEO para negocios"],
});

export default function BlogPage() {
  return <BlogView locale="es" />;
}
