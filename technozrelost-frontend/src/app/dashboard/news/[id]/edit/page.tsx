"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import NewsEditor from "@/components/dashboard/news-editor";

/** Редактор: правка существующей новости (тикет 08, спека §3.7). */
export default function EditNewsPage() {
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);

  return (
    <div data-od-id="news-editor-edit">
      <div className="border-b border-tz-border pb-6">
        <Link
          href="/dashboard/news"
          className="inline-flex items-center gap-1.5 text-sm text-tz-muted transition hover:text-tz-fg"
        >
          <ArrowLeft size={14} />
          К новостям
        </Link>
        <p className="tz-eyebrow mt-4">Редактор новостей</p>
        <h1 className="tz-page-title mt-2">Редактирование новости</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Правки опубликованной новости не меняют дату публикации — карточка не
          «всплывает» в ленте.
        </p>
      </div>
      <NewsEditor postId={Number.isFinite(postId) ? postId : undefined} />
    </div>
  );
}
