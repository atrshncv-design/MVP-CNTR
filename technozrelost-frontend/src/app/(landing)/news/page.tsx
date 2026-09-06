import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";
import NewsFeed from "@/components/landing/news-feed";
import { getPublicNewsCategories, getPublicNewsFeed } from "@/lib/api-client";
import { NEWS_PAGE_SIZE } from "@/lib/news-types";
import type { NewsCategory } from "@/lib/news-types";

// legacy маркер: title: "Новости — Технозрелость" (landing.metaNewsTitle)
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaNewsTitle"),
    description: t("metaNewsDesc"),
  };
}

export default async function NewsPage() {
  const t = await getTranslations("landing");
  let feed: Awaited<ReturnType<typeof getPublicNewsFeed>> | null = null;
  let categories: NewsCategory[] = [];
  let initialError: string | null = null;

  try {
    const [feedResult, categoriesResult] = await Promise.all([
      getPublicNewsFeed({ perPage: NEWS_PAGE_SIZE }),
      getPublicNewsCategories(),
    ]);
    feed = feedResult;
    categories = categoriesResult;
  } catch (err) {
    // Тексты бэкенда (R04) — как есть, фолбэк — через словарь.
    initialError = err instanceof Error && err.message ? err.message : t("newsLoadError");
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">{t("newsEyebrow")}</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">{t("newsTitle")}</h1>
        <p className="tz-lead mt-4 max-w-2xl">
          {t("newsLead")}
        </p>
      </Reveal>

      <NewsFeed
        initialFeed={feed}
        initialError={initialError}
        categories={categories}
      />
    </div>
  );
}
