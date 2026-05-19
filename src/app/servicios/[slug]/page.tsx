import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceLanding } from "@/components/site/service-landing";
import { getSeoService, seoServices } from "@/content/seo-services";
import { createMetadata } from "@/lib/site";

type ServicePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return seoServices.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getSeoService(slug);
  if (!service) return {};

  return createMetadata({
    title: service.metaTitle,
    description: service.metaDescription,
    path: `/servicios/${service.slug}`,
    keywords: service.keywords,
    locale: "es",
    alternatePath: null,
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = getSeoService(slug);

  if (!service) {
    notFound();
  }

  return <ServiceLanding service={service} />;
}
