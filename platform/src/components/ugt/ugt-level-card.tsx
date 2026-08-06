/**
 * T-011. Карточка уровня УГТ: название (ГОСТ), смысл, критерии перехода,
 * типичные доказательства, «что дальше» (Design.md §11).
 */

import {
  ugtLevelEvidence,
  ugtLevelMeaning,
  transitionCriteria,
} from "@/lib/ugt";
import {
  UGT_BAND_META,
  UGT_LEVEL_COLORS,
  bandRangeLabel,
  ugtLevelInfo,
} from "@/lib/ugt";
import { UgtBadge } from "@/components/ugt-badge";

export interface UgtLevelCardProps {
  level: number;
}

export function UgtLevelCard({ level }: UgtLevelCardProps) {
  const info = ugtLevelInfo(level);
  if (!info) return null;
  const meaning = ugtLevelMeaning(level);
  const criteria = transitionCriteria(level);
  const evidence = ugtLevelEvidence(level);
  const bandMeta = UGT_BAND_META[info.band];

  return (
    <article
      id={`ugt-${level}`}
      className="scroll-mt-24 rounded-panel border border-subtle bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UgtBadge level={level} />
        <p className="flex items-center gap-1.5 font-mono text-meta text-muted">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: UGT_LEVEL_COLORS[level - 1] }}
          />
          {bandMeta.label}: {bandRangeLabel(info.band)}
        </p>
      </div>

      {meaning ? (
        <p className="mt-4 text-small leading-relaxed text-primary">{meaning}</p>
      ) : null}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {criteria.length > 0 ? (
          <div>
            <p className="text-meta font-medium text-muted">
              Критерии перехода на уровень
            </p>
            <ul className="mt-2 space-y-1.5">
              {criteria.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-small leading-relaxed text-secondary"
                >
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div>
            <p className="text-meta font-medium text-muted">
              Типичные доказательства
            </p>
            <ul className="mt-2 space-y-1.5">
              {evidence.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-small leading-relaxed text-secondary"
                >
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {level < 9 ? (
        <p className="mt-5 rounded-panel bg-canvas p-3 text-small leading-relaxed text-secondary">
          Дальше — <strong className="font-medium text-primary">УГТ {level + 1}</strong>:{" "}
          {ugtLevelMeaning(level + 1)?.slice(0, 160) ?? ""}…
        </p>
      ) : (
        <p className="mt-5 rounded-panel bg-canvas p-3 text-small leading-relaxed text-secondary">
          УГТ 9 — финальный уровень пути: технология в серийном производстве,
          процессы контролируются.
        </p>
      )}
    </article>
  );
}
