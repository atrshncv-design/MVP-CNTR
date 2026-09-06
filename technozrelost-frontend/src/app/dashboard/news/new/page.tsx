"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import NewsEditor from "@/components/dashboard/news-editor";

/** Редактор: создание новости (тикет 08, спека §3.7). */
export default function NewNewsPage() {
  const t = useTranslations("dashboard");
  return (
    <div data-od-id="news-editor-new">
      <div className="border-b border-tz-border pb-6">
        <Link
          href="/dashboard/news"
          className="inline-flex items-center gap-1.5 text-sm text-tz-muted transition hover:text-tz-fg"
        >
          <ArrowLeft size={14} />
          {t("newsBack")}
        </Link>
        <p className="tz-eyebrow mt-4">{t("newsEditorEyebrow")}</p>
        <h1 className="tz-page-title mt-2">{t("newsNewTitle")}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          {t("newsNewDesc")}
        </p>
      </div>
      <NewsEditor />
    </div>
  );
}
