/**
 * T-009/T-011. Прогресс пути УГТ (ГОСТ Р 58048-2017).
 *
 * STATES.md §2: «текущий уровень» (последний ПРОВЕРЕННЫЙ уровень) и
 * «переход N → N+1» — отдельные понятия. Компонент показывает:
 * - трек уровней 1–9 с band-разметкой (число + название — цвет не
 *   единственный канал);
 * - текущий уровень — отдельно от состояния перехода N → N+1;
 * - следующий checkpoint из досье;
 * - текстовое объяснение позиции (describeUgtPosition).
 *
 * Полный вариант — страница «Путь УГТ», компактный — дашборд и карточки.
 */

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  HelpCircle,
} from "lucide-react";
import type { Status, TechnologyCheckpoint, TechnologyDossier } from "@/lib/types";
import {
  UGT_BAND_META,
  UGT_LEVELS,
  UGT_TRANSITION_META,
  bandRangeLabel,
  describeUgtPosition,
  formatUgt,
  ugtLevelInfo,
  type UgtTransitionState,
} from "@/lib/ugt";
import { getStatusMeta } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";

/** Проверен ли уровень: только подтверждённые решением/публикацией статусы. */
export function isUgtVerified(status: Status): boolean {
  return (
    status === "approved" ||
    status === "published" ||
    status === "active" ||
    status === "closed"
  );
}

const BAND_CELL: Record<string, string> = {
  low: "bg-ugt-low-soft text-ugt-low",
  medium: "bg-ugt-medium-soft text-ugt-medium",
  high: "bg-ugt-high-soft text-ugt-high",
};

export interface PathProgressProps {
  dossier: TechnologyDossier;
  /** Статус верификации досье (из карточки/черновика). */
  status: Status;
  /** Состояние перехода N → N+1 (STATES.md §2). */
  transition: UgtTransitionState;
  /** Компактный вариант (дашборд/карточки). */
  compact?: boolean;
}

/** Следующий checkpoint из досье (первый невыполненный, по уровню N+1). */
export function nextCheckpointOf(
  dossier: TechnologyDossier,
): TechnologyCheckpoint | null {
  if (dossier.checkpoints.length === 0) return null;
  const target = dossier.ugt.currentLevel + 1;
  return (
    dossier.checkpoints.find((cp) => cp.level === target) ??
    dossier.checkpoints[0] ??
    null
  );
}

export function PathProgress({
  dossier,
  status,
  transition,
  compact = false,
}: PathProgressProps) {
  const current = dossier.ugt.currentLevel;
  const verified = isUgtVerified(status);
  const nextCheckpoint = nextCheckpointOf(dossier);
  const transitionMeta = UGT_TRANSITION_META[transition];

  /* ------------------------- Компактный вариант ------------------------ */
  if (compact) {
    return (
      <div className="rounded-control bg-canvas p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-meta text-secondary">
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              verified ? "text-status-success" : "text-muted"
            }`}
          >
            {verified ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Clock className="h-3.5 w-3.5" aria-hidden />
            )}
            {verified ? "Текущий уровень: " : "Заявленный уровень: "}
            <span className="font-mono font-semibold text-primary">
              {formatUgt(current)}
            </span>
            {ugtLevelInfo(current) ? ` (${ugtLevelInfo(current)!.name})` : ""}
          </span>
          {current < 9 ? (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono font-semibold text-primary">
                  {formatUgt(current + 1)}
                </span>
                <span className="text-muted">· {transitionMeta.label}</span>
              </span>
            </>
          ) : null}
        </div>
        {nextCheckpoint ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
            <Flag className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            Следующий checkpoint: УГТ {nextCheckpoint.level} · {nextCheckpoint.title}
            {nextCheckpoint.evidenceCount > 0
              ? ` (свидетельств: ${nextCheckpoint.evidenceCount})`
              : ""}
          </p>
        ) : null}
      </div>
    );
  }

  /* --------------------------- Полный вариант -------------------------- */
  return (
    <div className="rounded-panel border border-subtle bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small font-semibold text-primary">Путь УГТ</p>
        <StatusBadge status={status} size="sm" />
      </div>

      {/* Трек уровней 1–9 */}
      <div
        className="mt-4 grid grid-cols-9 gap-1.5"
        role="img"
        aria-label={`Уровни готовности 1–9, текущий уровень ${current}${
          verified ? " подтверждён" : " заявлен"
        }${current < 9 ? `, следующий ${current + 1}` : ""}`}
      >
        {UGT_LEVELS.map((level) => {
          const isCurrent = level.number === current;
          const isNext = level.number === current + 1 && current < 9;
          const done = verified && level.number < current;
          return (
            <div
              key={level.number}
              className={`flex h-12 flex-col items-center justify-center rounded-control border font-mono text-small ${
                isCurrent
                  ? "border-accent bg-accent-soft font-semibold text-accent"
                  : isNext
                    ? "border-dashed border-strong bg-canvas text-primary"
                    : done
                      ? `${BAND_CELL[level.band]} border-transparent`
                      : "border-subtle bg-canvas text-muted"
              }`}
              title={`${formatUgt(level.number)} — ${level.name} (${UGT_BAND_META[level.band].label})`}
            >
              {level.number}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-meta leading-relaxed text-muted">
        Низкая готовность 1–3 · средняя 4–6 · высокая 7–9. Ячейка с рамкой —
        текущий уровень, пунктир — следующий (N+1).
      </p>

      {/* Текущий уровень vs переход */}
      <div className="mt-4 space-y-2">
        <p
          className={`flex items-start gap-2 text-small leading-relaxed ${
            verified ? "text-status-success" : "text-muted"
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {verified
              ? `Текущий уровень: ${formatUgt(current)}${
                  ugtLevelInfo(current) ? ` (${ugtLevelInfo(current)!.name})` : ""
                } — подтверждён проверкой${dossier.ugt.verificationDate ? ` ${dossier.ugt.verificationDate}` : ""}.`
              : `Заявленный уровень: ${formatUgt(current)}${
                  ugtLevelInfo(current) ? ` (${ugtLevelInfo(current)!.name})` : ""
                } — не подтверждён проверкой (STATES.md §2).`}
          </span>
        </p>
        <p className="flex items-start gap-2 text-small leading-relaxed text-secondary">
          <HelpCircle
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              transition === "blocked"
                ? "text-status-danger"
                : transition === "under_review"
                  ? "text-status-info"
                  : "text-accent"
            }`}
            aria-hidden
          />
          <span>
            <span className="font-medium text-primary">{transitionMeta.label}:</span>{" "}
            {transitionMeta.description}
          </span>
        </p>
        <p className="rounded-control bg-canvas px-3 py-2.5 text-meta leading-relaxed text-muted">
          {describeUgtPosition(current, transition, verified)}
        </p>
      </div>

      {/* Следующий checkpoint */}
      {nextCheckpoint ? (
        <div className="mt-4 rounded-control border border-subtle bg-canvas p-4">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            <Flag className="h-4 w-4 text-accent" aria-hidden />
            Следующий checkpoint
          </p>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            УГТ {nextCheckpoint.level} · {nextCheckpoint.title}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
            <span>Свидетельств в комплекте: {nextCheckpoint.evidenceCount}</span>
            {nextCheckpoint.dueDate ? (
              <span>Срок: {nextCheckpoint.dueDate}</span>
            ) : null}
            <span>Статус: {getStatusMeta(nextCheckpoint.status).label}</span>
          </p>
        </div>
      ) : (
        <p className="mt-4 text-meta text-muted">
          Checkpoint&apos;ов в досье пока нет — они появятся после подачи на
          проверку.
        </p>
      )}
    </div>
  );
}

/** Подпись диапазонов для легенды (переиспользуется страницами). */
export { UGT_BAND_META, bandRangeLabel };
