"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewsEditor from "@/components/dashboard/news-editor";

/** Редактор: создание новости (тикет 08, спека §3.7). */
export default function NewNewsPage() {
  return (
    <div data-od-id="news-editor-new">
      <div className="border-b border-tz-border pb-6">
        <Link
          href="/dashboard/news"
          className="inline-flex items-center gap-1.5 text-sm text-tz-muted transition hover:text-tz-fg"
        >
          <ArrowLeft size={14} />
          К новостям
        </Link>
        <p className="tz-eyebrow mt-4">Редактор новостей</p>
        <h1 className="tz-page-title mt-2">Новая новость</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Заполните заголовок, категорию и текст — можно сохранить черновик,
          опубликовать сразу или запланировать публикацию. Категория обязательна.
        </p>
      </div>
      <NewsEditor />
    </div>
  );
}
