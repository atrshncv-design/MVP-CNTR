/**
 * T-005. История решений (STATES.md §4). Каждое решение показывается с:
 * actor (кто видим), дата и время, подпись решения, причина/сводка, связанное
 * доказательство/комментарий, следующее действие, область видимости.
 *
 * Отклонение и уточнение ОБЯЗАНЫ иметь причину; одобрение и публикация —
 * шаг подтверждения (это валидируется вызывающим кодом; компонент честно
 * показывает отсутствующую причину как «Причина не указана» — без фабрикации).
 *
 * Компонент принимает display-тип DecisionTimelineItem (богаче доменного
 * Decision из types.ts: роль, комментарий, объектные доказательства).
 * Для доменных записей есть адаптер toDecisionTimelineItem().
 */

import type { ReactNode } from "react";
import {
  ArrowRight,
  FileText,
  Globe,
  Lock,
  MessageSquare,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, toneBadgeClasses } from "@/components/status-badge";
import { TONE_TEXT, type Status, type StatusTone } from "@/lib/status";
import { formatDateTime } from "@/lib/datetime";
import type { Decision } from "@/lib/types";

/** Область видимости решения (STATES.md §4 «visibility scope»). */
export type DecisionVisibility = "public" | "participants" | "staff" | "internal";

export interface DecisionEvidence {
  /** Подпись доказательства (например, «Заключение проверки №…»). */
  label: string;
  /** Ссылка на доказательство, если доступна. */
  href?: string;
}

/** Запись решения для отображения. */
export interface DecisionTimelineItem {
  id: string;
  /** Actor (имя или роль) — кто виден. */
  actor: string;
  /** Роль actor, если известна. */
  actorRole?: string;
  /** Дата и время решения. */
  decidedAt: Date | string;
  /** Решение: канонический статус или произвольная подпись + тональность. */
  decision: Status | { label: string; tone: StatusTone };
  /** Причина/сводка решения. Для rejected/clarification — обязательна. */
  reason?: string;
  /** Связанные доказательства. */
  evidence?: DecisionEvidence[];
  /** Контекстный комментарий. */
  comment?: string;
  /** Следующее действие после решения. */
  nextAction?: string;
  /** Область видимости. */
  visibility: DecisionVisibility;
}

const VISIBILITY_META: Record<
  DecisionVisibility,
  { label: string; icon: LucideIcon; textClass: string }
> = {
  public: { label: "Публично", icon: Globe, textClass: TONE_TEXT.success },
  participants: {
    label: "Участникам",
    icon: Users,
    textClass: TONE_TEXT.info,
  },
  staff: {
    label: "Сотрудникам ЦНТР",
    icon: ShieldCheck,
    textClass: TONE_TEXT.warning,
  },
  internal: { label: "Внутренняя", icon: Lock, textClass: TONE_TEXT.draft },
};

function DecisionBadge({
  decision,
}: {
  decision: DecisionTimelineItem["decision"];
}) {
  if (typeof decision === "object" && decision !== null && "label" in decision) {
    return (
      <span
        className={`inline-flex items-center rounded-control px-2.5 py-1 text-small font-medium ${toneBadgeClasses(decision.tone)}`}
      >
        {decision.label}
      </span>
    );
  }
  return <StatusBadge status={decision as Status} />;
}

function VisibilityChip({ visibility }: { visibility: DecisionVisibility }) {
  const meta = VISIBILITY_META[visibility];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-meta font-medium ${meta.textClass}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export interface DecisionTimelineProps {
  /** Решения в хронологическом порядке (сверху — последнее). */
  decisions: readonly DecisionTimelineItem[];
  /** Подпись пустого состояния. */
  emptyLabel?: string;
}

export function DecisionTimeline({
  decisions,
  emptyLabel = "Решений пока нет",
}: DecisionTimelineProps) {
  if (decisions.length === 0) {
    return (
      <p className="rounded-panel border border-dashed border-subtle bg-surface px-4 py-6 text-center text-small text-secondary">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol className="relative space-y-6 before:absolute before:inset-y-2 before:left-[15px] before:w-px before:bg-border-strong">
      {decisions.map((entry) => (
        <li key={entry.id} className="relative pl-12">
          {/* Маркер на линии времени */}
          <span
            className="absolute left-[9px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-status-draft"
            aria-hidden
          />
          <div className="rounded-panel border border-subtle bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <DecisionBadge decision={entry.decision} />
                <VisibilityChip visibility={entry.visibility} />
              </div>
              <time
                dateTime={
                  typeof entry.decidedAt === "string"
                    ? entry.decidedAt
                    : entry.decidedAt.toISOString()
                }
                className="font-mono text-meta text-muted"
              >
                {formatDateTime(entry.decidedAt)}
              </time>
            </div>

            <p className="mt-3 text-small font-medium text-primary">
              {entry.actor}
              {entry.actorRole ? (
                <span className="ml-2 font-normal text-secondary">
                  {entry.actorRole}
                </span>
              ) : null}
            </p>

            {entry.reason ? (
              <p className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
                <span className="font-medium text-primary">Причина: </span>
                {entry.reason}
              </p>
            ) : (
              <p className="mt-2 text-meta italic text-muted">
                Причина не указана
              </p>
            )}

            {entry.evidence && entry.evidence.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.evidence.map((evidence) =>
                  evidence.href ? (
                    <a
                      key={evidence.label}
                      href={evidence.href}
                      className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas/60 px-3 text-small text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {evidence.label}
                    </a>
                  ) : (
                    <span
                      key={evidence.label}
                      className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas/60 px-3 text-small text-secondary"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {evidence.label}
                    </span>
                  ),
                )}
              </div>
            ) : null}

            {entry.comment ? (
              <p className="mt-3 flex items-start gap-2 rounded-control bg-canvas/60 px-3 py-2.5 text-small leading-relaxed text-secondary">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                {entry.comment}
              </p>
            ) : null}

            {entry.nextAction ? (
              <p className="mt-3 flex items-start gap-2 text-small text-secondary">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="font-medium text-primary">Следующее действие: </span>
                  {entry.nextAction}
                </span>
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Адаптер доменной записи → элемент таймлайна                        */
/* ------------------------------------------------------------------ */

/** Маппинг scope адаптера на видимость решения. */
export function mapVisibilityScope(
  scope: Decision["visibilityScope"],
): DecisionVisibility {
  switch (scope) {
    case "public":
      return "public";
    case "participant":
      return "participants";
    case "operations":
      return "staff";
  }
}

/** Доменное решение (types.ts) → элемент таймлайна. */
export function toDecisionTimelineItem(
  decision: Decision,
  visibility: DecisionVisibility = mapVisibilityScope(
    decision.visibilityScope,
  ),
): DecisionTimelineItem {
  return {
    id: decision.id,
    actor: decision.actor,
    decidedAt: decision.dateTime,
    decision: decision.decision,
    reason: decision.reason ?? undefined,
    evidence: decision.linkedEvidence.map((label) => ({ label })),
    nextAction: decision.nextAction ?? undefined,
    visibility,
  };
}

/** Плейсхолдер-пропсы для композиции с комментариями (STATES.md §5). */
export type DecisionTimelineChildren = ReactNode;
