/**
 * T-007. Связанные записи: запросы заказчиков, пилоты, исследования.
 * Показываются только реальные связи; пусто — честно (STATES.md §3).
 */

import { FlaskConical, Link2, Rocket } from "lucide-react";
import type { TechnologyDossier } from "@/lib/types";

export interface DossierRelatedProps {
  dossier: TechnologyDossier;
}

export function DossierRelated({ dossier }: DossierRelatedProps) {
  const hasRequests = dossier.customerRequestsAndMatches.length > 0;
  const hasPilots = dossier.pilots.length > 0;

  if (!hasRequests && !hasPilots) {
    return (
      <section
        aria-labelledby="related-heading"
        className="rounded-panel border border-subtle bg-surface p-6"
      >
        <h2
          id="related-heading"
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          <Link2 className="h-5 w-5 text-accent" aria-hidden />
          Связанные записи
        </h2>
        <p className="mt-3 text-small leading-relaxed text-secondary">
          Связанных запросов заказчиков и пилотов пока нет. Связи появятся после
          начала приёмной кампании.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="related-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="related-heading"
        className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
      >
        <Link2 className="h-5 w-5 text-accent" aria-hidden />
        Связанные записи
      </h2>

      {hasRequests ? (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-meta font-medium text-muted">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Запросы заказчиков
          </p>
          <ul className="mt-2 space-y-1.5">
            {dossier.customerRequestsAndMatches.map((match) => (
              <li key={match.requestId} className="text-small text-secondary">
                {match.title}
                {match.matchScore !== null ? ` · совпадение ${match.matchScore}%` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasPilots ? (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-meta font-medium text-muted">
            <Rocket className="h-3.5 w-3.5" aria-hidden />
            Пилоты
          </p>
          <ul className="mt-2 space-y-1.5">
            {dossier.pilots.map((pilot) => (
              <li key={pilot.id} className="text-small text-secondary">
                {pilot.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
