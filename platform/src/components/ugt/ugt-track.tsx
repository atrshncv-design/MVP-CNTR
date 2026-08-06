/**
 * T-011. Полный трек УГТ 1–9 с band-разметкой и подсветкой ТЕКУЩЕГО уровня.
 * Сегмент текущего уровня заливается цветом уровня (UGT_LEVEL_COLORS, D-07),
 * остальные сегменты — border-subtle. Цвет — не единственный канал:
 * число + название + band (STATES.md §2).
 */

import { UGT_LEVEL_COLORS, UGT_LEVELS } from "@/lib/ugt";

export interface UgtTrackProps {
  /** Текущий (заявленный или подтверждённый) уровень. */
  currentLevel: number;
  /** Подтверждён ли уровень проверкой Центра. */
  verified: boolean;
  /** Свернуть подписи уровней (мобильный вариант). */
  compact?: boolean;
}

export function UgtTrack({ currentLevel, verified, compact = false }: UgtTrackProps) {
  return (
    <div
      role="img"
      aria-label={`Трек УГТ: ${compact ? "" : "уровни 1–9, "}текущий ${currentLevel}${
        verified ? " (подтверждён)" : " (не подтверждён проверкой)"
      }`}
      className="select-none"
    >
      <div className="flex items-center gap-1.5">
        {UGT_LEVELS.map((level) => {
          const isCurrent = level.number === currentLevel;
          return (
            <div key={level.number} className="flex-1">
              <div
                className={`h-2 rounded-full transition-colors ${
                  isCurrent ? "" : "bg-border-subtle"
                }`}
                style={
                  isCurrent
                    ? { backgroundColor: UGT_LEVEL_COLORS[level.number - 1] }
                    : undefined
                }
              />
              {!compact ? (
                <p
                  className={`mt-1.5 text-center font-mono text-meta ${
                    isCurrent ? "font-semibold text-primary" : "text-muted"
                  }`}
                >
                  {level.number}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {compact ? (
        <p className="mt-2 text-meta text-muted">
          УГТ {currentLevel} из 9 ·{" "}
          {verified ? "подтверждён проверкой" : "не подтверждён проверкой"}
        </p>
      ) : null}
    </div>
  );
}
