import { AboutView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "About",
  description:
    "Meet Kenneth Duron, creator of Ken Code, a premium web studio building modern, SEO-ready websites and digital solutions for international clients.",
  path: "/en/about",
  locale: "en",
  keywords: ["Kenneth Duron", "Ken Code", "remote web developer", "international web studio"],
});

export default function EnglishAboutPage() {
  return <AboutView locale="en" />;
}
