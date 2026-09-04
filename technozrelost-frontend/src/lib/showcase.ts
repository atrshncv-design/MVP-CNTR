/**
 * Public project showcase demo data.
 * Placeholder until the public registry API is connected: cards show
 * typical platform projects. Fields match ProjectSummary from dashboards.
 * Display strings live in the showcase dictionary (next-intl); this module
 * holds only key metadata plus resolvers taking a translator function.
 */

import type { TranslateFn } from "./types";
import ruMessages from "../messages/ru.json" with { type: "json" };

export interface ShowcaseProject {
  id: number;
  name: string;
  category: string;
  description: string;
  current_level: number;
  status: "draft" | "active" | "review" | "completed";
  budget: number | null;
  org: string;
  region: string;
}

interface ShowcaseDictProject {
  name: string;
  category: string;
  description: string;
  org: string;
  region: string;
}

interface ShowcaseDict {
  projects: Record<string, ShowcaseDictProject>;
  categories: string[];
}

function showcaseDict(): ShowcaseDict {
  return (ruMessages as unknown as { showcase: ShowcaseDict }).showcase;
}

/** Non-textual card metadata (ids, levels, statuses, budgets). */
const SHOWCASE_META: ReadonlyArray<{
  id: number;
  current_level: number;
  status: ShowcaseProject["status"];
  budget: number | null;
}> = [
  { id: 1, current_level: 6, status: "active", budget: 48_000_000 },
  { id: 2, current_level: 4, status: "active", budget: 12_500_000 },
  { id: 3, current_level: 7, status: "review", budget: 76_000_000 },
  { id: 4, current_level: 5, status: "active", budget: 21_000_000 },
  { id: 5, current_level: 8, status: "completed", budget: 94_000_000 },
  { id: 6, current_level: 3, status: "draft", budget: 8_400_000 },
  { id: 7, current_level: 2, status: "draft", budget: 6_000_000 },
  { id: 8, current_level: 6, status: "review", budget: 34_000_000 },
  { id: 9, current_level: 5, status: "active", budget: 18_000_000 },
];

/** Stable category slugs in canonical order (parallel to dictionary categories). */
export const SHOWCASE_CATEGORY_SLUGS = ["ai", "nioktr", "manufacturing", "medicine"] as const;

export type ShowcaseCategorySlug = (typeof SHOWCASE_CATEGORY_SLUGS)[number];

function projectText(id: number): ShowcaseDictProject {
  return showcaseDict().projects[`p${id}`];
}

function toProject(
  meta: (typeof SHOWCASE_META)[number],
  text: ShowcaseDictProject,
): ShowcaseProject {
  return {
    id: meta.id,
    name: text.name,
    category: text.category,
    description: text.description,
    current_level: meta.current_level,
    status: meta.status,
    budget: meta.budget,
    org: text.org,
    region: text.region,
  };
}

export const SHOWCASE_PROJECTS: ShowcaseProject[] = SHOWCASE_META.map((meta) =>
  toProject(meta, projectText(meta.id)),
);

export const SHOWCASE_CATEGORIES: string[] = showcaseDict().categories;

/** Localised showcase cards (translator scoped to the showcase namespace). */
export function getShowcaseProjects(t: TranslateFn): ShowcaseProject[] {
  return SHOWCASE_META.map((meta) =>
    toProject(meta, {
      name: t(`projects.p${meta.id}.name`),
      category: t(`projects.p${meta.id}.category`),
      description: t(`projects.p${meta.id}.description`),
      org: t(`projects.p${meta.id}.org`),
      region: t(`projects.p${meta.id}.region`),
    }),
  );
}

/** Localised category labels in canonical order. */
export function getShowcaseCategories(t: TranslateFn): string[] {
  return SHOWCASE_CATEGORY_SLUGS.map((_, index) => t(`categories.${index}`));
}

/** Localised label for one category slug. */
export function getShowcaseCategoryLabel(t: TranslateFn, slug: ShowcaseCategorySlug): string {
  const index = (SHOWCASE_CATEGORY_SLUGS as readonly string[]).indexOf(slug);
  return t(`categories.${index}`);
}
