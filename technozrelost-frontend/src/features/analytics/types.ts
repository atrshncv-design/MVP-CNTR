/**
 * Типы аналитики ЦНТР (тикет 08, G33.1, G34, G50).
 * Почему отдельный модуль: админ макс-аналитика агрегирует
 * GET /admin/achievements/stats + GET /projects фронт; менеджер урезанная.
 * Типы совмместимы с lib/types, lib/status, lib/api-client из 01.
 */

import type { ProjectCardOut } from "@/lib/types";

// ─── Срезы админ-статы из бэка (GET /admin/achievements/stats) ───────────────

export interface AchievementStatsTotals {
  total_awards: number;
  awards_last_week: number;
  unique_users: number;
  unique_projects: number;
}

export interface StatsPoint {
  date: string;
  count: number;
}

export interface StatsGroupItem {
  key: string;
  count: number;
  percent: number;
}

export interface StatsSectorItem {
  category: string;
  count: number;
  projects: number;
}

export interface AdminStats {
  generated_at: string;
  totals: AchievementStatsTotals;
  by_day: StatsPoint[];
  by_week: StatsPoint[];
  by_group: StatsGroupItem[];
  by_rarity: StatsGroupItem[];
  by_sector: StatsSectorItem[];
  top_achievements: Array<{
    slug: string;
    title: string;
    group: string;
    rarity: string;
    count: number;
  }>;
  stalled_projects: Array<{
    id: number;
    name: string;
    current_level: number;
    days: number;
  }>;
  manager_review: {
    avg_hours: number | null;
    decided_count: number;
  };
}

// ─── Воронка проектов ───────────────────────────────────────────────────────

export const FUNNEL_STATUSES = [
  "draft",
  "auto_confirmed",
  "published",
  "active",
  "completed",
] as const;

export type FunnelStatus = (typeof FUNNEL_STATUSES)[number];

export interface FunnelData {
  draft: number;
  auto_confirmed: number;
  published: number;
  active: number;
  completed: number;
  rejected: number;
  archived: number;
  total: number;
}

// ─── Разрезы по тегам / регионам ────────────────────────────────────────────

export interface SectorRow {
  tag: string;
  count: number;
  percent: number;
}

export interface RegionRow {
  region: string;
  count: number;
  percent: number;
}

// ─── Проекты для аналитики (используем ProjectCardOut из lib/types) ────────

export type AnalyticsProject = ProjectCardOut;
