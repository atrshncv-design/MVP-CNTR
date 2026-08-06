/**
 * T-007. Сборка представления technology dossier по (объект, роль, scope).
 *
 * Публичный scope: только публичные поля — никаких внутренних комментариев,
 * никаких решений с видимостью ≠ public. participant/operations — полные
 * данные кабинета/Центра (фикстуры с бейджем на стороне UI).
 */

import type { Decision, TechnologyDossier } from "@/lib/types";

export interface DossierView {
  dossier: TechnologyDossier;
  /** Решения, видимые в этом представлении (отфильтрованы по scope). */
  decisions: Decision[];
  /** Публично ли показывается сводка решений (для публичного паспорта). */
  showDecisionSummary: boolean;
}

/** Видимые решения по scope (STATES.md §4: visibility scope). */
function visibleDecisions(dossier: TechnologyDossier, scope: string): Decision[] {
  if (scope === "public") {
    return dossier.decisionHistory.filter((d) => d.visibilityScope === "public");
  }
  return dossier.decisionHistory;
}

export function buildDossierView(
  dossier: TechnologyDossier,
  scope: "public" | "participant" | "operations",
): DossierView {
  return {
    dossier,
    decisions: visibleDecisions(dossier, scope),
    showDecisionSummary: scope === "public",
  };
}

/** Связанные объекты для секции «Связанные записи» (публичный паспорт). */
export function relatedCounts(dossier: TechnologyDossier): {
  requests: number;
  pilots: number;
} {
  return {
    requests: dossier.customerRequestsAndMatches.length,
    pilots: dossier.pilots.length,
  };
}
