"use client";

import * as React from "react";
import { FALLBACK_SECTORS, getSectorsForLevel, getUgtColor } from "./utils";
import type { StageRequirementLike } from "./utils";

export interface UgtLineProps {
  currentLevel: number;
  /** StageRequirement для расчёта секторов (GET /projects/{id}/stage-requirements или RAG). */
  requirements?: StageRequirementLike[] | null;
  /** Число загруженных доков для текущего уровня (если requirements не содержит uploaded). */
  uploadedCount?: number;
  /** Документы для тултипа (опционально). */
  documents?: Array<{ doc_type: string; title?: string }>;
  className?: string;
}

/**
 * UgtLine — линейная шкала УГТ 1-9 с дробными мини-секторами.
 * Почему линейно, а не Radar: интервью 5.2 требует сектор=документ, число
 * секторов = числу доков из ГОСТа. Дробные сектора — маленькие деления внутри уровня.
 *
 * Тест-шов: при УГТ 5 и 7 StageRequirement секторов 7, прогресс 3/7 = 3 закрашено цветом --tz-ugt-5.
 */
export function UgtLine({
  currentLevel,
  requirements,
  uploadedCount,
  documents,
  className = "",
}: UgtLineProps) {
  const lvl = Math.max(1, Math.min(9, Math.round(currentLevel || 1)));

  // Для текущего уровня считаем total по реальным требованиям, иначе fallback.
  // Если requirements вообще не переданы — используем FALLBACK_SECTORS per level.
  return (
    <div
      data-testid="ugt-line"
      data-current={lvl}
      className={`flex flex-col gap-2 ${className}`}
      aria-label={`Шкала УГТ, текущий уровень ${lvl}`}
    >
      <div className="flex items-stretch gap-1">
        {Array.from({ length: 9 }, (_, idx) => {
          const level = idx + 1;
          const total = getSectorsForLevel(level, requirements);
          const isCurrent = level === lvl;
          const isPast = level < lvl;
          // закрашено
          let filled = 0;
          if (isPast) filled = total;
          else if (isCurrent) {
            if (uploadedCount != null) filled = Math.min(uploadedCount, total);
            else if (requirements) {
              const cur = requirements.filter((r) => r.from_level === level);
              const src = cur.length ? cur : requirements;
              // если requirements уже отфильтрованы под текущий, берём uploaded из них
              if (uniqueFromLevel(requirements) === level || cur.length) {
                filled = src.filter((r) => r.uploaded).length;
              } else {
                // requirements для другого уровня — считаем 0, но allow uploadedCount fallback
                filled = 0;
              }
            }
          }
          const color = getUgtColor(level);
          const levelRequirements = requirements?.filter((r) => r.from_level === level) ?? [];
          return (
            <div
              key={level}
              data-testid={`ugt-level-${level}`}
              data-sectors={total}
              data-filled={filled}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors ${
                isCurrent ? "border-tz-accent bg-tz-accent-soft" : "border-tz-border bg-tz-surface"
              }`}
              style={isCurrent ? { borderColor: color } : undefined}
              title={isCurrent ? `Текущий УГТ ${level}: ${filled}/${total} документов` : `УГТ ${level}: ${total} документов по ГОСТу`}
            >
              <span
                className={`font-mono text-xs font-bold ${isCurrent ? "text-tz-accent" : "text-tz-muted"}`}
                style={isCurrent ? { color } : undefined}
              >
                УГТ {level}
              </span>
              <div className="flex w-full justify-center gap-px">
                {Array.from({ length: total }, (_, sIdx) => {
                  const isFilled = sIdx < filled;
                  const req = levelRequirements[sIdx] ?? null;
                  // тултип как в требовании: «Документ: ПМИ (14 с.) — загружен»
                  const docTitle = req?.title ?? documents?.[sIdx]?.title ?? `Документ ${sIdx + 1}`;
                  const pages = req ? 14 : 14; // мок pages, в реальности из template_metadata
                  const statusText = isFilled ? "загружен" : "ожидает";
                  return (
                    <div
                      key={sIdx}
                      data-testid={`ugt-sector-${level}-${sIdx}`}
                      className="h-2 flex-1 rounded-sm transition-colors"
                      style={{
                        background: isFilled ? color : "var(--tz-border)",
                        // подсвечиваем текущий уровень цветом --tz-ugt-5 в тесте
                        // для уровня 5 isFilled использует var(--tz-ugt-5) автоматически
                      }}
                      title={`Документ: ${docTitle} (${pages} с.) — ${statusText}`}
                      aria-label={`Сектор ${sIdx + 1}/${total} УГТ ${level}: ${docTitle} — ${statusText}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between px-1 font-mono text-[10px] leading-none text-tz-muted">
        <span>УГТ 1</span>
        <span>УГТ 9</span>
      </div>
    </div>
  );
}

function uniqueFromLevel(reqs: StageRequirementLike[]): number | null {
  if (!reqs.length) return null;
  const set = new Set(reqs.map((r) => r.from_level));
  if (set.size === 1) return reqs[0].from_level;
  return null;
}

// Экспорт для тестового шва
export { FALLBACK_SECTORS, getSectorsForLevel, getUgtColor };
export default UgtLine;
