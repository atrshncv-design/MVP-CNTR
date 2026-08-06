/**
 * T-007. История решений в досье (STATES.md §4). Пусто — честно:
 * «Решений пока нет» с объяснением, без выдуманной истории.
 */

import { ScrollText } from "lucide-react";
import type { Decision } from "@/lib/types";
import {
  DecisionTimeline,
  toDecisionTimelineItem,
} from "@/components/decision-timeline";

export interface DossierDecisionHistoryProps {
  decisions: Decision[];
  /** Текстовое объяснение при пустой истории (по режиму). */
  emptyLabel?: string;
}

export function DossierDecisionHistory({
  decisions,
  emptyLabel = "Решений пока нет. История появится после первого решения Центра.",
}: DossierDecisionHistoryProps) {
  return (
    <section
      aria-labelledby="decisions-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="decisions-heading"
        className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
      >
        <ScrollText className="h-5 w-5 text-accent" aria-hidden />
        История решений
      </h2>
      <div className="mt-4">
        <DecisionTimeline
          decisions={decisions.map((decision) => toDecisionTimelineItem(decision))}
          emptyLabel={emptyLabel}
        />
      </div>
    </section>
  );
}
