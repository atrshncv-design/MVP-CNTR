/**
 * T-007. Сводка УГТ: текущий проверенный уровень, путь, переход N→N+1.
 * STATES.md §2: текущий уровень ≠ переход; текстовое объяснение обязательно.
 */

import type { TechnologyDossier } from "@/lib/types";
import {
  UGT_BAND_META,
  UGT_TRANSITION_META,
  bandRangeLabel,
  describeUgtPosition,
  ugtLevelInfo,
} from "@/lib/ugt";
import { formatDate } from "@/lib/datetime";

export interface DossierUgtSummaryProps {
  dossier: TechnologyDossier;
  /** Режим: публичный — только факты, участник — +переход, Центр — +решения. */
  scope: "public" | "participant" | "operations";
}

export function DossierUgtSummary({ dossier, scope }: DossierUgtSummaryProps) {
  const level = dossier.ugt.currentLevel;
  const band = dossier.ugt.band;
  const bandMeta = UGT_BAND_META[band];
  const info = ugtLevelInfo(level);
  const verified = dossier.ugt.verificationDate !== null;
  const position = describeUgtPosition(level, "preparing", verified);

  return (
    <section
      aria-labelledby="ugt-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="ugt-heading"
          className="text-h3 font-semibold tracking-tight text-primary"
        >
          Уровень готовности технологии
        </h2>
        <p className="font-mono text-meta text-muted">
          УГТ {level} · {bandRangeLabel(band)}
        </p>
      </div>

      <p className="mt-3 text-body leading-relaxed text-primary">
        УГТ {level} — «{info?.name}». {bandMeta.label}: уровни {bandRangeLabel(band)}.
        УГТ показывает расстояние до конкретного результата внедрения, а не
        общую оценку качества.
      </p>

      <div className="mt-5 rounded-panel bg-canvas p-4">
        <p className="text-meta font-medium text-muted">Текущее положение</p>
        <p className="mt-1.5 text-small leading-relaxed text-primary">
          {position}
        </p>
      </div>

      {dossier.ugt.verificationDate ? (
        <p className="mt-4 text-meta text-muted">
          Подтверждён проверкой: {formatDate(dossier.ugt.verificationDate)}
        </p>
      ) : (
        <p className="mt-4 text-meta text-muted">
          {scope === "public"
            ? "Дата верификации не раскрывается до публикации записи."
            : "Дата верификации пока не зафиксирована."}
        </p>
      )}

      {dossier.ugt.history.length > 0 ? (
        <div className="mt-5">
          <p className="text-meta font-medium text-muted">История уровней</p>
          <ul className="mt-2 space-y-1.5">
            {dossier.ugt.history.map((entry, index) => (
              <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-secondary">
                <span className="font-mono text-meta text-muted">УГТ {entry.level}</span>
                <span>{entry.actor}</span>
                {entry.date ? <span className="text-meta text-muted">{formatDate(entry.date)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scope !== "public" ? (
        <div className="mt-5 border-t border-border-subtle pt-4">
          <p className="text-meta font-medium text-muted">Переход N&nbsp;→&nbsp;N+1</p>
          <p className="mt-1.5 text-small leading-relaxed text-secondary">
            {UGT_TRANSITION_META.preparing.label}. Подготовка следующего
            checkpoint&apos;а: критерии и недостающие свидетельства — в разделе
            «Checkpoint&apos;ы».
          </p>
        </div>
      ) : null}
    </section>
  );
}
