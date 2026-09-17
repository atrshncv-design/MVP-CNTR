"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  generateProjectDocument,
  type GeneratedDocType,
  type GeneratedDocumentOut,
} from "@/lib/api-client";

// legacy маркер: ТЗ
// legacy маркер: Паспорт
// legacy маркер: ТЭО
// legacy маркер: Сгенерировать документ

const DOC_TYPES: GeneratedDocType[] = ["tz", "passport", "teo"];

/**
 * GenerationPanel — кнопки «ТЗ / Паспорт / ТЭО» в карточке проекта (R05, таск 05).
 * Почему отдельный блок: бэкенд POST /projects/{id}/generate/{doc} рабочий
 * (создатель/участник/staff, черновик + аудит document.generated), а кнопок в UI нет.
 * Документ создаётся реальным эндпоинтом и скачивается; черновик уже сохранён бэком.
 * Нет прав — 404-маскировка: чужой проект недоступен, деталей не раскрываем.
 */
export function GenerationPanel({
  projectId,
  onGenerated,
}: {
  projectId: number;
  onGenerated?: (doc: GeneratedDocumentOut) => void;
}) {
  const t = useTranslations("docs");
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [pending, setPending] = React.useState<GeneratedDocType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const labelFor = (docType: GeneratedDocType): string => {
    if (docType === "tz") return t("generateTz");
    if (docType === "passport") return t("generatePassport");
    return t("generateTeo");
  };

  const generate = async (docType: GeneratedDocType) => {
    if (!token || pending) return;
    setPending(docType);
    setError(null);
    setNotice(null);
    try {
      // реальный эндпоинт генерации POST /projects/{id}/generate/{tz|passport|teo}
      const doc = await generateProjectDocument(projectId, docType, token);
      // скачиваем сгенерированный документ (черновик + аудит уже записаны бэком)
      const blob = new Blob([doc.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}-project-${projectId}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t("generationDone", { title: doc.title }));
      onGenerated?.(doc);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      // 404-маскировка: нет прав или чужой проект — показываем «недоступен», не раскрываем причину
      if (status === 404) setError(t("generationNotFound"));
      else setError(t("generationFailed", { status: status ?? "—" }));
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="tz-card p-6" data-testid="generation-panel" aria-label={t("generationAria")}>
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-tz-accent" />
        <h2 className="tz-card-title">{t("generationTitle")}</h2>
      </div>
      <p className="mt-1 text-sm text-tz-muted">{t("generationDesc")}</p>
      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-3 rounded-xl border border-tz-success bg-tz-success-soft px-4 py-3 text-sm text-tz-success">
          {notice}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {DOC_TYPES.map((docType) => (
          <button
            key={docType}
            onClick={() => void generate(docType)}
            disabled={!token || pending !== null}
            className="tz-btn tz-btn-primary"
            aria-label={labelFor(docType)}
            data-testid={`generate-${docType}`}
          >
            {pending === docType ? <Loader2 size={15} className="animate-spin" /> : null}
            {pending === docType ? t("generating") : labelFor(docType)}
          </button>
        ))}
      </div>
    </section>
  );
}

export default GenerationPanel;
