"use client";

import Link from "next/link";
import { Activity, Building2 } from "lucide-react";

import { formatRelative, formatShortDate } from "@/lib/format-date";
import { getStatusBadge, getStatusLabel } from "@/lib/status";
import type { RegistryProjectOut } from "@/lib/types";

import { FavoriteStar } from "./FavoriteStar";

function formatBudget(budget: number | null | undefined): string {
  if (budget == null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

/**
 * Карточка реестра — только карточки, без таблицы (тикет 04, G33).
 * Бюджет всем виден (G38), дата 31.03.2027 + тултип «2 дня назад» (G47),
 * сортировка по дате ↓ обеспечивается useRegistry.
 * Partial data — «—» вместо отсутствующих полей.
 */
export function RegistryCard({
  project,
  href,
  isFavorite,
  onToggleFavorite,
}: {
  project: RegistryProjectOut;
  href?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const badge = getStatusBadge(project.status ?? "draft");
  const label = getStatusLabel(project.status ?? "draft");
  const shortDate = formatShortDate(project.updated_at ?? project.created_at ?? null);
  const relative = formatRelative(project.updated_at ?? project.created_at ?? null);
  const tags = project.tags?.length ? project.tags : project.category ? [project.category] : [];

  const cardInner = (
    <div className="tz-card tz-card-hover flex h-full flex-col p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</span>
          <span className={`tz-badge ${badge}`}>{label}</span>
          {tags[0] ? <span className="tz-badge tz-badge-neutral">{tags[0]}</span> : null}
        </div>
        {onToggleFavorite ? (
          <FavoriteStar active={!!isFavorite} onToggle={onToggleFavorite} label={project.name} />
        ) : null}
      </div>

      <h3 className="line-clamp-2 font-bold text-tz-fg">{project.name || "—"}</h3>
      {project.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-tz-muted">{project.description}</p>
      ) : (
        <p className="mt-1 text-sm text-tz-muted">—</p>
      )}

      {tags.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 5).map((t) => (
            <span key={t} className="tz-badge tz-badge-neutral text-[11px]">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-tz-muted">
        <span className="flex items-center gap-1.5">
          <Activity size={14} className="text-tz-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-bold text-tz-accent">УГТ {project.current_level ?? "—"}</span>
          <span aria-hidden="true">→</span>
          <span className="font-mono text-xs">{project.target_level ?? "—"}</span>
        </span>
        <span className="flex items-center gap-1">
          <Building2 size={14} className="text-tz-muted" aria-hidden="true" />
          {project.organization ?? "—"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-tz-border pt-3 text-xs">
        <span className="font-medium text-tz-fg">{formatBudget(project.budget)}</span>
        {shortDate ? (
          <span className="text-tz-muted" title={relative || undefined}>
            {shortDate}
          </span>
        ) : (
          <span className="text-tz-muted">—</span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {cardInner}
      </Link>
    );
  }
  return cardInner;
}
