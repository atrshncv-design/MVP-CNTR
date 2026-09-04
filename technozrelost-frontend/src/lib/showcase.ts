/**
 * Public project showcase demo data.
 * Placeholder until the public registry API is connected: cards show
 * typical platform projects. Fields match ProjectSummary from dashboards.
 * Display strings resolve through the showcase dictionary (next-intl) via a
 * translator of the current locale; category is a stable slug.
 */

import type { TranslateFn } from "./types";

export interface ShowcaseProject {
  id: number;
  name: string;
  category: ShowcaseCategorySlug;
  description: string;
  current_level: number;
  status: "draft" | "active" | "review" | "completed";
  budget: number | null;
  org: string;
  region: string;
}

/** Stable category slugs in canonical order (keys of showcase.categories). */
export const SHOWCASE_CATEGORY_SLUGS = ["ai", "nioktr", "manufacturing", "medicine"] as const;

export type ShowcaseCategorySlug = (typeof SHOWCASE_CATEGORY_SLUGS)[number];

/** Non-textual card metadata (ids, levels, statuses, budgets, category slugs). */
const SHOWCASE_META: ReadonlyArray<{
  id: number;
  category: ShowcaseCategorySlug;
  current_level: number;
  status: ShowcaseProject["status"];
  budget: number | null;
}> = [
  { id: 1, category: "nioktr", current_level: 6, status: "active", budget: 48_000_000 },
  { id: 2, category: "ai", current_level: 4, status: "active", budget: 12_500_000 },
  { id: 3, category: "manufacturing", current_level: 7, status: "review", budget: 76_000_000 },
  { id: 4, category: "nioktr", current_level: 5, status: "active", budget: 21_000_000 },
  { id: 5, category: "manufacturing", current_level: 8, status: "completed", budget: 94_000_000 },
  { id: 6, category: "ai", current_level: 3, status: "draft", budget: 8_400_000 },
  { id: 7, category: "nioktr", current_level: 2, status: "draft", budget: 6_000_000 },
  { id: 8, category: "ai", current_level: 6, status: "review", budget: 34_000_000 },
  { id: 9, category: "medicine", current_level: 5, status: "active", budget: 18_000_000 },
];

/** Localised showcase cards (translator scoped to the showcase namespace). */
export function getShowcaseProjects(t: TranslateFn): ShowcaseProject[] {
  return SHOWCASE_META.map((meta) => ({
    id: meta.id,
    name: t(`projects.p${meta.id}.name`),
    category: meta.category,
    description: t(`projects.p${meta.id}.description`),
    current_level: meta.current_level,
    status: meta.status,
    budget: meta.budget,
    org: t(`projects.p${meta.id}.org`),
    region: t(`projects.p${meta.id}.region`),
  }));
}

/** Localised category labels in canonical order. */
export function getShowcaseCategories(t: TranslateFn): string[] {
  return SHOWCASE_CATEGORY_SLUGS.map((slug) => t(`categories.${slug}`));
}

/** Localised label for one category slug. */
export function getShowcaseCategoryLabel(t: TranslateFn, slug: ShowcaseCategorySlug): string {
  return t(`categories.${slug}`);
}
