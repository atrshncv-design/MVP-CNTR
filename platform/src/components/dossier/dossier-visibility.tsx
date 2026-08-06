/**
 * T-007. Видимость и публикация записи (проверочный режим + публичный
 * паспорт): статус публикации, даты, правило «в реестр после проверки».
 */

import { Eye } from "lucide-react";
import type { TechnologyDossier } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/datetime";

export interface DossierVisibilityProps {
  dossier: TechnologyDossier;
}

export function DossierVisibility({ dossier }: DossierVisibilityProps) {
  const visibility = dossier.visibility;

  return (
    <section
      aria-labelledby="visibility-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="visibility-heading"
        className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
      >
        <Eye className="h-5 w-5 text-accent" aria-hidden />
        Публикация и видимость
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={visibility.publicationStatus} />
        <span className="text-meta text-muted">
          видимость: {visibility.scope}
        </span>
      </div>

      <p className="mt-4 text-small leading-relaxed text-secondary">
        В публичный реестр записи попадают только после проверки Центром:
        досье, свидетельства и уровень готовности УГТ. Черновики и записи на
        проверке публично не показываются.
      </p>

      {visibility.publishedAt ? (
        <p className="mt-3 text-meta text-muted">
          Опубликовано: {formatDate(visibility.publishedAt)}
        </p>
      ) : null}
      <p className="mt-1 text-meta text-muted">
        Обновлено: {formatDate(visibility.updatedAt)}
      </p>
    </section>
  );
}
