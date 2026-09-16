import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ProjectsShowcase from "@/components/landing/projects-showcase";
import { fetchPublicRegistryPage } from "../public-registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaProjectsTitle"),
    description: t("metaProjectsDesc"),
  };
}

/**
 * P3 (таск 09, G04/G35/G49/G59): публичный реестр на живых проверенных данных.
 * Первая страница читается сервером анонимно (без Authorization, limit +
 * keyset-пагинация after_id); дальше браузер дотягивает страницы сам через
 * rewrites. Пустой реестр — честное пустое состояние с CTA в регистрацию
 * (порядок «инфоконтур → ЛК → реестры», G06); сбой — ошибка с ретраем,
 * приватных полей и действий на странице нет.
 */
export default async function ProjectsPage() {
  const t = await getTranslations("projectsLanding");
  const { items, failed, status } = await fetchPublicRegistryPage();
  const initialError = failed
    ? typeof status === "number"
      ? t("loadErrorStatus", { status })
      : t("loadError")
    : null;
  return <ProjectsShowcase initialItems={items} initialError={initialError} />;
}
