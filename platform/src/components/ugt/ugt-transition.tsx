/**
 * T-011. Блок перехода N → N+1 с состоянием (UGT_TRANSITION_META) и
 * следующими checkpoint'ами. STATES.md §2: переход — отдельное понятие
 * от текущего уровня.
 */

import { ArrowRight } from "lucide-react";
import {
  UGT_TRANSITION_META,
  type UgtTransitionState,
  ugtLevelInfo,
} from "@/lib/ugt";
import type { TechnologyCheckpoint } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

export interface UgtTransitionProps {
  currentLevel: number;
  transition: UgtTransitionState;
  /** Следующие checkpoint&apos;ы пути (отсортированы по level). */
  checkpoints?: TechnologyCheckpoint[];
}

export function UgtTransition({
  currentLevel,
  transition,
  checkpoints = [],
}: UgtTransitionProps) {
  const meta = UGT_TRANSITION_META[transition];
  const nextLevel = ugtLevelInfo(currentLevel + 1);

  return (
    <section
      aria-labelledby="transition-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="transition-heading"
        className="text-h3 font-semibold tracking-tight text-primary"
      >
        Переход N → N+1
      </h2>

      <p className="mt-3 text-small leading-relaxed text-primary">
        Текущий уровень: <strong className="font-medium">УГТ {currentLevel}</strong>
        {nextLevel ? ` → следующий: УГТ ${currentLevel + 1} «${nextLevel.name}»` : ""}
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-panel bg-canvas p-4">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="text-meta font-medium text-muted">{meta.label}</p>
          <p className="mt-1 text-small leading-relaxed text-secondary">
            {meta.description}
          </p>
        </div>
      </div>

      {checkpoints.length > 0 ? (
        <div className="mt-5">
          <p className="text-meta font-medium text-muted">Следующие checkpoint&apos;ы</p>
          <ul className="mt-2 space-y-2">
            {checkpoints
              .filter((checkpoint) => checkpoint.level > currentLevel)
              .slice(0, 3)
              .map((checkpoint) => (
                <li
                  key={checkpoint.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-border-subtle px-4 py-3"
                >
                  <div>
                    <p className="text-small font-medium text-primary">
                      УГТ {checkpoint.level} · {checkpoint.title}
                    </p>
                    {checkpoint.dueDate ? (
                      <p className="mt-0.5 text-meta text-muted">
                        Срок: {checkpoint.dueDate}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={checkpoint.status} size="sm" />
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
