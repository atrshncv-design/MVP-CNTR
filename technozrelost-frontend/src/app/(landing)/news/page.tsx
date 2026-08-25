import type { Metadata } from "next";
import Reveal from "@/components/landing/reveal";
import NewsFeed from "@/components/landing/news-feed";
import { getPublicNewsCategories, getPublicNewsFeed } from "@/lib/api-client";
import { NEWS_PAGE_SIZE } from "@/lib/news-types";
import type { NewsCategory } from "@/lib/news-types";

export const metadata: Metadata = {
  title: "Новости — Технозрелость",
  description:
    "Публикации платформы «Технозрелость»: новости ЦНТР УР, проекты и технологии по ГОСТ Р 58048-2017.",
};

export default async function NewsPage() {
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
    initialError =
      err instanceof Error ? err.message : "Не удалось загрузить новости.";
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">Публикации платформы</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">Новости</h1>
        <p className="tz-lead mt-4 max-w-2xl">
          Официальные публикации платформы «Технозрелость»: события центра,
          развитие проектов и технологии Удмуртии.
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
