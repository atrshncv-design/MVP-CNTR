"use client";

import type { SectorRow, StatsSectorItem, RegionRow } from "./types";

/**
 * SectorRows — разрез по отраслям/тегам 30+ (тикет 08, G33.1).
 * Источник: фронтагрегация по tags (PROJECT_TAGS 32) + бэк by_sector (by_sector из stats).
 * Показываем обе строки для полноты среза.
 */
export function SectorRows({
  rows,
  title = "Отрасли по тегам (30+)",
  testId = "sector-rows",
}: {
  rows: SectorRow[];
  title?: string;
  testId?: string;
}) {
  return (
    <div className="tz-card p-5" data-testid={testId}>
      <h3 className="font-semibold text-tz-fg">{title}</h3>
      <p className="mt-1 text-xs text-tz-muted">Разрез по 30+ тегам (front-агрегация из GET /projects)</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">Тегов пока нет — проекты без tags</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.slice(0, 12).map((r) => (
            <div key={r.tag} data-testid={`sector-row-${r.tag}`} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-tz-fg">{r.tag}</span>
              <span className="font-mono text-xs text-tz-muted">
                {r.count} · {r.percent}%
              </span>
              <div className="h-2 w-24 shrink-0 rounded-full bg-tz-soft">
                <div className="h-2 rounded-full bg-[var(--tz-accent)]" style={{ width: `${r.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BackendSectorRows({
  rows,
  title = "Отрасли (бек by_sector)",
}: {
  rows: StatsSectorItem[];
  title?: string;
}) {
  return (
    <div className="tz-card p-5" data-testid="backend-sector-rows">
      <h3 className="font-semibold text-tz-fg">{title}</h3>
      <p className="mt-1 text-xs text-tz-muted">Из GET /admin/achievements/stats.by_sector (category → count)</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">Секторов пока нет</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.slice(0, 12).map((r) => (
            <div key={r.category} data-testid={`backend-sector-${r.category}`} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-tz-fg">{r.category}</span>
              <span className="font-mono text-xs text-tz-muted">
                {r.count} проектов: {r.projects}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RegionRows({
  rows,
  title = "Муниципалитеты / регионы",
  testId = "region-rows",
}: {
  rows: RegionRow[];
  title?: string;
  testId?: string;
}) {
  return (
    <div className="tz-card p-5" data-testid={testId}>
      <h3 className="font-semibold text-tz-fg">{title}</h3>
      <p className="mt-1 text-xs text-tz-muted">Разрез по Organization.region (муниципалитеты/регионы)</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">Регионов пока нет</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.slice(0, 12).map((r) => (
            <div key={r.region} data-testid={`region-row-${r.region}`} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-tz-fg">{r.region}</span>
              <span className="font-mono text-xs text-tz-muted">
                {r.count} · {r.percent}%
              </span>
              <div className="h-2 w-24 shrink-0 rounded-full bg-tz-soft">
                <div className="h-2 rounded-full bg-[var(--tz-success)]" style={{ width: `${r.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
