/**
 * Утилиты аналитики (тикет 08, G33.1, G34, G45-G47).
 * Почему отдельный модуль: воронка суммы = total, срезы по 30+ тегам и регионам
 * считаются фронт-агрегацией из GET /projects (не лезем в project/registry core).
 * Использует lib/types/status/filters/api-client из 01.
 */

import type { ProjectCardOut } from "@/lib/types";
import type { FunnelData, RegionRow, SectorRow } from "./types";

// ─── Бюджет: всем виден, Intl.NumberFormat ru-RU RUB (G38) ─────────────────

export function formatBudget(budget: number | null | undefined): string {
  if (budget == null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

// ─── Воронка: draft → auto_confirmed → published → active → completed ───────
// Сумма воронки (5 линейных + rejected + archived) = total проектов — тест 08.
// Если проектов нет — все нули.
export function buildFunnel(projects: ProjectCardOut[]): FunnelData {
  const counts: Record<string, number> = {
    draft: 0,
    auto_confirmed: 0,
    published: 0,
    active: 0,
    completed: 0,
    rejected: 0,
    archived: 0,
  };
  for (const p of projects) {
    const s = String(p.status ?? "draft");
    if (s in counts) counts[s] += 1;
    else counts.draft += 1;
  }
  const total = projects.length;
  return {
    draft: counts.draft,
    auto_confirmed: counts.auto_confirmed,
    published: counts.published,
    active: counts.active,
    completed: counts.completed,
    rejected: counts.rejected,
    archived: counts.archived,
    total,
  };
}

// Проверка инварианта для теста: сумма воронки = total
export function funnelSumsToTotal(funnel: FunnelData): boolean {
  const sum =
    funnel.draft +
    funnel.auto_confirmed +
    funnel.published +
    funnel.active +
    funnel.completed +
    funnel.rejected +
    funnel.archived;
  return sum === funnel.total;
}

// ─── Срез по тегам (отрасли 30+ тегов) ─────────────────────────────────────

export function buildSectorRows(projects: ProjectCardOut[]): SectorRow[] {
  const map = new Map<string, number>();
  for (const p of projects) {
    const tags = p.tags?.length ? p.tags : p.category ? [p.category] : [];
    for (const t of tags) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  const total = projects.length || 1;
  const rows: SectorRow[] = [...map.entries()]
    .map(([tag, count]) => ({
      tag,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
  return rows;
}

// ─── Срез по регионам/муниципалитетам (Organization.region) ─────────────────
// Почему через organization string: ProjectCardOut.organization — имя,
// регион берём из отдельного списка OrganizationOut или из project-расширения.
// Если регион отсутствует — группируем как «Без региона».
export function buildRegionRowsFromProjects(
  projects: ProjectCardOut[],
  orgRegionMap?: Map<string, string | null>,
): RegionRow[] {
  const map = new Map<string, number>();
  for (const p of projects) {
    const orgName = p.organization ?? "—";
    const region = orgRegionMap?.get(orgName) ?? (p as unknown as { region?: string | null }).region ?? null;
    const key = region?.trim() ? region.trim() : "Без региона";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const total = projects.length || 1;
  return [...map.entries()]
    .map(([region, count]) => ({
      region,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

// Отдельный хелпер для OrganizationOut[] (когда есть данные с /nioktr/organizations)
export function buildRegionRowsFromOrgs(
  orgs: Array<{ region: string | null; projects_count?: number }>,
): RegionRow[] {
  const map = new Map<string, number>();
  for (const o of orgs) {
    const key = o.region?.trim() ? o.region!.trim() : "Без региона";
    // если есть projects_count — взвешиваем, иначе 1
    const weight = typeof o.projects_count === "number" && o.projects_count > 0 ? o.projects_count : 1;
    map.set(key, (map.get(key) ?? 0) + weight);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map.entries()]
    .map(([region, count]) => ({
      region,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Сортировка по дате ↓ (G46) ─────────────────────────────────────────────

export function sortByUpdatedDesc<T extends { updated_at?: string | null; created_at?: string | null }>(
  a: T,
  b: T,
): number {
  const da = a.updated_at ?? a.created_at ?? "";
  const db = b.updated_at ?? b.created_at ?? "";
  if (da === db) {
    const ida = (a as unknown as { id: number }).id ?? 0;
    const idb = (b as unknown as { id: number }).id ?? 0;
    return idb - ida;
  }
  return db.localeCompare(da);
}

// ─── Пагинация 20 + показать ещё (G45) ──────────────────────────────────────

export const ANALYTICS_LIMIT = 20;

export function paginate<T>(items: T[], page: number, limit = ANALYTICS_LIMIT): { slice: T[]; hasMore: boolean } {
  const end = page * limit;
  return {
    slice: items.slice(0, end),
    hasMore: items.length > end,
  };
}

// ─── Только светлая палитра (G48) — без тёмной ─────────────────────────────
// Константы цветов — только светлые токены --tz-*
export const LIGHT_PALETTE_ONLY = true;

// ─── Дата 31.03.2027 + тултип «2 дня назад» (G47) ───────────────────────────
// Реэкспорт из lib/format-date для единообразия
export { formatShortDate, formatRelative } from "@/lib/format-date";
