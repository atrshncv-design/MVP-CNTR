import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ProjectsShowcase from "@/components/landing/projects-showcase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaProjectsTitle"),
    description: t("metaProjectsDesc"),
  };
}

export default function ProjectsPage() {
  return <ProjectsShowcase />;
}
