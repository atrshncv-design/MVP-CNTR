import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsDetailView from "@/components/landing/news-detail";
import { ApiError, getPublicNewsDetail } from "@/lib/api-client";
import type { NewsDetail } from "@/lib/news-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let post: NewsDetail | null = null;
  try {
    post = await getPublicNewsDetail(id);
  } catch {
    return { title: "Новость не найдена — Технозрелость" };
  }
  return {
    title: `${post.title} — Новости — Технозрелость`,
    description: post.excerpt ?? post.title,
  };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let post: NewsDetail;
  try {
    post = await getPublicNewsDetail(id);
  } catch (err) {
    // Неопубликованная/несуществующая новость и невалидный id — честная 404.
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
      notFound();
    }
    throw err;
  }

  return <NewsDetailView post={post} />;
}
