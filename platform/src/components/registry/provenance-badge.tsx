/**
 * T-006. Provenance-бейдж: откуда пришли данные и когда импортированы.
 * Показывается только при реальном provenance (ResearchRecord.provenance);
 * отсутствующие значения не фабрикуются — дата импорта скрывается, если null.
 */

import { Database } from "lucide-react";
import { formatDate } from "@/lib/datetime.ts";
import type { ResearchProvenance } from "@/lib/types.ts";

export interface ProvenanceBadgeProps {
  provenance: ResearchProvenance;
  /** Компактный вариант (таблица, списки). */
  compact?: boolean;
}

export function ProvenanceBadge({
  provenance,
  compact = false,
}: ProvenanceBadgeProps) {
  const importedLabel = provenance.importedAt
    ? `импортировано ${formatDate(provenance.importedAt)}`
    : null;

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 text-meta text-muted ${
        compact ? "" : "leading-relaxed"
      }`}
      title={
        provenance.sourceUrl ??
        `Источник: ${provenance.source}${importedLabel ? `, ${importedLabel}` : ""}`
      }
    >
      <Database className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{provenance.source}</span>
      {importedLabel ? (
        <span className="hidden sm:inline">·</span>
      ) : null}
      {importedLabel ? <span className="hidden sm:inline">{importedLabel}</span> : null}
    </span>
  );
}
