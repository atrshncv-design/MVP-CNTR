import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ProjectsShowcase from "@/components/landing/projects-showcase";
import { getPublicRegistry } from "@/lib/api-client";
import { SHOWCASE_PAGE_SIZE } from "@/lib/landing-registry";
import type { RegistryProjectOut } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaProjectsTitle"),
    description: t("metaProjectsDesc"),
  };
}

export default async function ProjectsPage() {
  const t = await getTranslations("projectsLanding");
  // Первая страница живого публичного реестра (таск 13, R06i):
  // без токена, через внутренний адрес бэкенда. Ошибка SSR не роняет
  // сборку — клиент попробует сам через rewrites того же origin.
  let initialItems: RegistryProjectOut[] = [];
  let initialError: string | null = null;
  try {
    initialItems = await getPublicRegistry({ limit: SHOWCASE_PAGE_SIZE });
  } catch (err) {
    initialError = err instanceof Error && err.message ? err.message : t("loadError");
  }
  return <ProjectsShowcase initialItems={initialItems} initialError={initialError} />;
}
