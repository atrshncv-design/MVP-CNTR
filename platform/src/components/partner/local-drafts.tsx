/**
 * T-009. Досье-черновики, созданные формой «Представить технологию»
 * (localStorage, partner-storage). Показываются отдельной секцией поверх
 * досье организации-фикстур: статус, заявленный уровень, ссылки на
 * доказательства и путь УГТ, удаление черновика.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck, Flag, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { formatRelativeOrDateTime } from "@/lib/datetime";
import {
  listTechnologyDrafts,
  removeTechnologyDraft,
  type TechnologyDraftRecord,
} from "@/lib/partner-storage";

export function LocalDrafts() {
  const [drafts, setDrafts] = useState<TechnologyDraftRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setDrafts(listTechnologyDrafts().filter((d) => d.created));
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  if (drafts.length === 0) return null;

  const handleDelete = (id: string) => {
    removeTechnologyDraft(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <section aria-labelledby="local-drafts-heading" className="mt-10">
      <h2
        id="local-drafts-heading"
        className="text-h3 font-semibold tracking-tight text-primary"
      >
        Мои черновики
      </h2>
      <p className="mt-1 text-meta text-muted">
        Досье, созданные в этом браузере. После подачи на проверку они получат
        статус «На проверке» — на этом компьютере.
      </p>
      <ul className="mt-4 space-y-3">
        {drafts.map((draft) => {
          const level = draft.fields.claimedLevel ?? 1;
          return (
            <li
              key={draft.id}
              className="rounded-panel border border-dashed border-strong bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-small font-semibold text-primary">
                    {draft.fields.title.trim() || "Новое досье технологии"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <UgtBadge level={level} showBand={false} />
                    <StatusBadge status={draft.status} size="sm" />
                  </div>
                  <p className="mt-1.5 text-meta text-muted">
                    Обновлено {formatRelativeOrDateTime(draft.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(draft.id)}
                  aria-label={`Удалить черновик: ${draft.fields.title}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-canvas text-muted transition-colors hover:border-status-danger hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/app/partner/technologies/${draft.id}/evidence`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control bg-accent-strong px-3 text-meta font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <FileCheck className="h-3.5 w-3.5" aria-hidden />
                  Продолжить: доказательства
                </Link>
                <Link
                  href={`/app/partner/technologies/${draft.id}/path`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  Путь УГТ
                </Link>
                <Link
                  href={`/app/partner/technologies/${draft.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Досье
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
