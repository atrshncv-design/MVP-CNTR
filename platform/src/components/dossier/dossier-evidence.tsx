/**
 * T-007. Сводка доказательств: публичные документы и свидетельства
 * (Design.md §5.2, секция 6). Публичный режим — только публичные документы.
 */

import { FileCheck2, FileText } from "lucide-react";
import type { TechnologyDossier } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/datetime";

export interface DossierEvidenceProps {
  dossier: TechnologyDossier;
  /** Публичный режим: показывать только документы, доступные публично. */
  publicOnly?: boolean;
}

export function DossierEvidence({ dossier, publicOnly = false }: DossierEvidenceProps) {
  const evidence = publicOnly ? [] : dossier.evidence;

  return (
    <section
      aria-labelledby="evidence-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="evidence-heading"
        className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
      >
        <FileCheck2 className="h-5 w-5 text-accent" aria-hidden />
        Доказательства
      </h2>

      {evidence.length === 0 ? (
        <p className="mt-3 text-small leading-relaxed text-secondary">
          {publicOnly
            ? "Публичные доказательства появятся после проверки записи Центром."
            : "Свидетельства пока не загружены. Требования к доказательствам — в разделе «Checkpoint'ы»."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {evidence.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-panel bg-canvas p-4"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-small font-medium leading-snug text-primary">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-meta text-muted">
                    {item.kind}
                    {item.uploadedAt ? ` · ${formatDate(item.uploadedAt)}` : ""}
                  </p>
                </div>
              </div>
              <StatusBadge status={item.status} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
