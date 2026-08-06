/**
 * T-012. Документы организации (/app/documents).
 * Фикстуры документов + локально загруженные (nfr-org-documents).
 * Загрузка — upload-состояния по STATES.md §6 (выбрано → загружается →
 * проверяется; «принято» — только после завершения проверки).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { organizationDocumentFixtures } from "@/data/fixtures";
import {
  addOrgDocument,
  listOrgDocuments,
  removeOrgDocument,
  type LocalOrgDocument,
} from "@/lib/documents";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

const INPUT_CLASS =
  "w-full rounded-control border border-subtle bg-canvas px-3.5 py-2.5 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring";

export default function DocumentsPage() {
  const [locals, setLocals] = useState<LocalOrgDocument[]>([]);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState<"idle" | "uploading" | "review">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLocals(listOrgDocuments());
    })();
  }, []);

  const documents = useMemo(
    () => [...organizationDocumentFixtures, ...locals],
    [locals],
  );

  const upload = () => {
    const trimmed = title.trim();
    if (!trimmed || uploading === "uploading") return;
    setError(null);
    setUploading("uploading");
    (async () => {
      try {
        addOrgDocument({ title: trimmed, kind: "Документ организации" });
        setLocals(listOrgDocuments());
        setTitle("");
        setUploading("review");
      } catch {
        setError("Не удалось загрузить документ. Попробуйте ещё раз.");
        setUploading("idle");
      }
    })();
  };

  return (
    <div className={CONTAINER}>
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-h2 font-semibold tracking-tight text-primary">
          <FileText className="h-6 w-6 text-accent" aria-hidden />
          Документы организации
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Документы, подтверждающие компетенции и технологическую готовность.
          «Принято» появляется только после проверки файла Центром.
        </p>
      </header>

      <section
        aria-labelledby="upload-heading"
        className="mt-6 max-w-3xl rounded-panel border border-subtle bg-surface p-6"
      >
        <h2 id="upload-heading" className="text-small font-semibold text-primary">
          Загрузить документ
        </h2>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Название документа (например: устав, лицензия, сертификат)"
            className={`${INPUT_CLASS} flex-1 min-w-[260px]`}
            aria-label="Название документа"
          />
          <button
            type="button"
            onClick={upload}
            disabled={!title.trim() || uploading === "uploading"}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" aria-hidden />
            {uploading === "uploading" ? "Загружается…" : "Загрузить"}
          </button>
        </div>
        {uploading === "review" ? (
          <p className="mt-3 text-small text-status-warning" role="status">
            Документ загружен и направлен на проверку Центром. Статус
            изменится после завершения проверки.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-small text-status-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {documents.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Документов пока нет"
            description="Документы появятся после проверки Центром или загрузки вашей организацией."
            icon={FileText}
          />
        </div>
      ) : (
        <ul className="mt-6 max-w-3xl space-y-3">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-subtle bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-small font-medium text-primary">
                    {document.title}
                  </p>
                  <p className="mt-0.5 text-meta text-muted">
                    {isFixtureRecord(document) ? "пример документа" : "ваш документ"}
                    {"uploadedAt" in document && document.uploadedAt
                      ? ` · ${formatDate((document as LocalOrgDocument).uploadedAt)}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={document.status} size="sm" />
                {isFixtureRecord(document) ? <FixtureBadge /> : null}
                {!isFixtureRecord(document) ? (
                  <button
                    type="button"
                    onClick={() => {
                      removeOrgDocument(document.id);
                      setLocals(listOrgDocuments());
                    }}
                    className="rounded-control px-2 py-1 text-meta font-medium text-status-danger transition-colors hover:bg-status-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    Удалить
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
