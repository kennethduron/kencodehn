import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailView } from "@/components/site/localized-pages";
import { getContent } from "@/content/site-content";
import { createMetadata } from "@/lib/site";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

const projects = getContent("en").projects;

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);
  if (!project) return {};

  return createMetadata({
    title: `${project.name} | Case Study`,
    description: `${project.name}: ${project.result}`,
    path: `/en/projects/${project.slug}`,
    locale: "en",
    keywords: [project.category, ...project.benefits],
  });
}

export default async function EnglishProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug);

  if (!project) {
    notFound();
  }

  return <ProjectDetailView locale="en" project={project} />;
}
