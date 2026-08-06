/**
 * T-010. Аналитика операционного центра (тикет: «Счётчики и аналитика — по
 * реальным данным или отсутствуют», ROLES.md «data-backed trends»).
 *
 * Компонент принимает готовые метрики от серверной страницы: значение и
 * ЯВНЫЙ источник (реальные данные НИОКТР / контролируемые UI-фикстуры).
 * Ничего не вычисляет и не фабрикует — если данных нет, страница не
 * передаёт метрику, и карточка не выводится.
 */

import { Database, FlaskConical, type LucideIcon } from "lucide-react";

export interface AnalyticsMetric {
  /** Короткая подпись метрики. */
  label: string;
  /** Число (только из реальных/фикстурных данных). */
  value: number;
  /** Откуда взято число. */
  source: string;
  /** true — источником являются реальные данные (реестр НИОКТР и т.п.). */
  real?: boolean;
  /** Дополнительная подпись под значением (например «из 7 задач»). */
  detail?: string;
  /** Иконка карточки. */
  icon?: LucideIcon;
}

/** Бейдж источника: реальные данные / фикстуры UI (демо). */
export function SourceBadge({ real }: { real?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-meta font-medium ${
        real
          ? "bg-status-success-soft text-status-success"
          : "bg-status-draft-soft text-status-draft"
      }`}
    >
      {real ? "Реальные данные" : "Фикстуры UI (демо)"}
    </span>
  );
}

export interface OpsAnalyticsProps {
  /** Метрики, посчитанные страницей строго по данным. */
  metrics: AnalyticsMetric[];
  /** Распределение по статусам очереди (label → count, только из данных). */
  statusBreakdown?: { label: string; count: number }[];
  /** Пояснение по источникам. */
  sourcesNote?: string;
}

export function OpsAnalytics({
  metrics,
  statusBreakdown = [],
  sourcesNote,
}: OpsAnalyticsProps) {
  if (metrics.length === 0) {
    return (
      <p className="rounded-panel border border-dashed border-subtle bg-surface px-4 py-8 text-center text-small text-secondary">
        Показатели появятся, когда в системе будут реальные записи и задачи
        очереди.
      </p>
    );
  }

  const maxBreakdown = Math.max(1, ...statusBreakdown.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon ?? Database;
          return (
            <section
              key={metric.label}
              className="rounded-panel border border-subtle bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-control bg-canvas"
                  aria-hidden
                >
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                </span>
                <SourceBadge real={metric.real} />
              </div>
              <p className="mt-4 font-mono text-h2 font-semibold tracking-tight text-primary">
                {metric.value}
              </p>
              <h3 className="mt-1 text-small font-medium text-secondary">
                {metric.label}
              </h3>
              {metric.detail ? (
                <p className="mt-1 text-meta text-muted">{metric.detail}</p>
              ) : null}
              <p className="mt-2 text-meta text-muted">Источник: {metric.source}</p>
            </section>
          );
        })}
      </div>

      {statusBreakdown.length > 0 ? (
        <section
          aria-labelledby="analytics-statuses"
          className="rounded-panel border border-subtle bg-surface p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="analytics-statuses"
              className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
            >
              <FlaskConical className="h-5 w-5 text-accent" aria-hidden />
              Очередь по статусам
            </h2>
            <SourceBadge />
          </div>
          <ul className="mt-4 space-y-2.5">
            {statusBreakdown.map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-small text-secondary">
                  {item.label}
                </span>
                <span
                  className="h-2.5 rounded-full bg-accent/70"
                  style={{
                    width: `${Math.max(
                      4,
                      Math.round((item.count / maxBreakdown) * 100),
                    )}%`,
                  }}
                  aria-hidden
                />
                <span className="font-mono text-meta text-muted">
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sourcesNote ? (
        <p className="text-meta leading-relaxed text-muted">{sourcesNote}</p>
      ) : null}
    </div>
  );
}
