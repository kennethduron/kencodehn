import { ProjectsView } from "@/components/site/localized-pages";
import { createMetadata } from "@/lib/site";

export const metadata = createMetadata({
  title: "Ken Code Web Projects",
  description:
    "Real Ken Code projects with images, results and external links: digital menus, service websites, catalogs and professional web experiences.",
  path: "/en/projects",
  locale: "en",
  keywords: ["web portfolio", "business website case studies", "professional web design", "international web development"],
});

export default function EnglishProjectsPage() {
  return <ProjectsView locale="en" />;
}
