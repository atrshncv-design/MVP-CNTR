"use client";

import { useTranslations } from "next-intl";
import type { SectorRow, StatsSectorItem, RegionRow } from "./types";

/**
 * SectorRows — разрез по отраслям/тегам 30+ (тикет 08, G33.1).
 * Источник: фронтагрегация по tags (PROJECT_TAGS 32) + бэк by_sector (by_sector из stats).
 * Показываем обе строки для полноты среза.
 */
export function SectorRows({
  rows,
  title,
  testId = "sector-rows",
}: {
  rows: SectorRow[];
  title?: string;
  testId?: string;
}) {
  const t = useTranslations("common");
  const heading = title ?? t("sectorTagsTitle");
  return (
    <div className="tz-card p-5" data-testid={testId}>
      <h3 className="font-semibold text-tz-fg">{heading}</h3>
      <p className="mt-1 text-xs text-tz-muted">{t("sectorTagsHint")}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">{t("sectorTagsEmpty")}</p>
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
  title,
}: {
  rows: StatsSectorItem[];
  title?: string;
}) {
  const t = useTranslations("common");
  const heading = title ?? t("sectorBackendTitle");
  return (
    <div className="tz-card p-5" data-testid="backend-sector-rows">
      <h3 className="font-semibold text-tz-fg">{heading}</h3>
      <p className="mt-1 text-xs text-tz-muted">{t("sectorBackendHint")}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">{t("sectorBackendEmpty")}</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.slice(0, 12).map((r) => (
            <div key={r.category} data-testid={`backend-sector-${r.category}`} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-tz-fg">{r.category}</span>
              <span className="font-mono text-xs text-tz-muted">
                {t("sectorBackendCount", { count: r.count, projects: r.projects })}
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
  title,
  testId = "region-rows",
}: {
  rows: RegionRow[];
  title?: string;
  testId?: string;
}) {
  const t = useTranslations("common");
  const heading = title ?? t("regionTitle");
  return (
    <div className="tz-card p-5" data-testid={testId}>
      <h3 className="font-semibold text-tz-fg">{heading}</h3>
      <p className="mt-1 text-xs text-tz-muted">{t("regionHint")}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">{t("regionEmpty")}</p>
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
