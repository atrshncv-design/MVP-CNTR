/**
 * UGT/UGP/UGI/UGS methodology content (GOST R 58048-2017).
 * Display strings resolve through the ugt dictionary (next-intl) via a
 * translator of the current locale; this module holds only key metadata
 * (ids, colors, ranges, month estimates) plus resolvers. No locale is the
 * default: every display string comes from t().
 */

import type { TranslateFn } from "./types";
import { shimList } from "./translators.ts";
import protocolData from "./protocol.json" with { type: "json" };

export interface DeliverableDoc {
  name: string;
  template: string;
  description: string;
}

export interface RiskItem {
  risk: string;
  solution: string;
  probability: "low" | "medium" | "high";
}

export interface UGTLevel {
  id: number;
  code: string;
  name: string;
  short: string;
  description: string;
  color: string;
  requirements: string[];
  deliverables: string[];
  deliverableDocs: DeliverableDoc[];
  kpi: Record<string, string>;
  risks: RiskItem[];
}

interface Protocol {
  levelDocTemplates: Record<string, string[]>;
  transitionDocTemplates: Record<string, string[]>;
}

function protocol(): Protocol {
  return protocolData as unknown as Protocol;
}

/** String array at a dictionary path (structured entries via t.raw). */
function strArr(t: TranslateFn, key: string): string[] {
  const value = t.raw(key);
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

/** Entry count of a dictionary array (objects included). */
function arrLen(t: TranslateFn, key: string): number {
  const value = t.raw(key);
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Curated risk probabilities mirror the legacy table.
 * Non-textual metadata: only level 9 carries a "low" probability.
 */
function levelProbability(levelId: number, riskIndex: number): RiskItem["probability"] {
  if (levelId === 9 && riskIndex === 1) return "low";
  const high: ReadonlyArray<readonly [number, number]> = [
    [1, 1], [3, 1], [4, 1], [5, 0], [6, 1], [7, 0], [8, 1],
  ];
  return high.some(([l, r]) => l === levelId && r === riskIndex) ? "high" : "medium";
}

/** Non-textual per-level metadata (colors). */
const UGT_META: ReadonlyArray<{ id: number; color: string }> = [
  { id: 1, color: "#2E5BFF" },
  { id: 2, color: "#3B6CFF" },
  { id: 3, color: "#4A82FF" },
  { id: 4, color: "#5B9BD5" },
  { id: 5, color: "#6AB0B5" },
  { id: 6, color: "#7EC8A0" },
  { id: 7, color: "#A8D65A" },
  { id: 8, color: "#E5C840" },
  { id: 9, color: "#FF7A2E" },
];

/** Level ids for static generation (locale-free). */
export const UGT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Level colors by id order (locale-free design tokens). */
export const UGT_COLORS: readonly string[] = UGT_META.map((m) => m.color);

function toUgtLevel(t: TranslateFn, id: number): UGTLevel {
  const base = `levels.l${id}`;
  const templates = protocol().levelDocTemplates[`l${id}`] ?? [];
  const docsCount = arrLen(t, `${base}.docs`);
  const risksCount = arrLen(t, `${base}.risks`);
  return {
    id,
    code: t(`${base}.code`),
    name: t(`${base}.name`),
    short: t(`${base}.short`),
    description: t(`${base}.description`),
    color: UGT_META[id - 1].color,
    requirements: strArr(t, `${base}.requirements`),
    deliverables: strArr(t, `${base}.deliverables`),
    deliverableDocs: Array.from({ length: docsCount }, (_, i) => ({
      name: t(`${base}.docs.${i}.name`),
      template: templates[i] ?? "",
      description: t(`${base}.docs.${i}.description`),
    })),
    kpi: {
      [t("kpiLabels.publications")]: t(`${base}.kpi.publications`),
      [t("kpiLabels.patents")]: t(`${base}.kpi.patents`),
      [t("kpiLabels.prototype")]: t(`${base}.kpi.prototype`),
    },
    risks: Array.from({ length: risksCount }, (_, i) => ({
      risk: t(`${base}.risks.${i}.risk`),
      solution: t(`${base}.risks.${i}.solution`),
      probability: levelProbability(id, i),
    })),
  };
}

/** Localised UGT levels (translator scoped to the ugt namespace). */
export function getUgtLevels(t: TranslateFn): UGTLevel[] {
  return UGT_IDS.map((id) => toUgtLevel(t, id));
}

/** Localised single UGT level; unknown ids resolve to level 1. */
export function getUgtLevel(t: TranslateFn, id: number): UGTLevel {
  const known = (UGT_IDS as readonly number[]).includes(id) ? id : 1;
  return toUgtLevel(t, known);
}

export interface UGPLevel {
  id: number;
  code: string;
  name: string;
  color: string;
}

const UGP_META: ReadonlyArray<{ id: number; color: string }> = [
  { id: 1, color: "#2E5BFF" },
  { id: 2, color: "#3B6CFF" },
  { id: 3, color: "#4A82FF" },
  { id: 4, color: "#5B9BD5" },
  { id: 5, color: "#6AB0B5" },
  { id: 6, color: "#7EC8A0" },
  { id: 7, color: "#A8D65A" },
  { id: 8, color: "#D4C840" },
  { id: 9, color: "#E5A030" },
  { id: 10, color: "#FF7A2E" },
];

function toUgpLevel(t: TranslateFn, id: number, color: string): UGPLevel {
  return { id, code: t(`ugp.l${id}.code`), name: t(`ugp.l${id}.name`), color };
}

/** Localised UGP levels. */
export function getUgpLevels(t: TranslateFn): UGPLevel[] {
  return UGP_META.map((meta) => toUgpLevel(t, meta.id, meta.color));
}

export interface UGILevel {
  id: number;
  code: string;
  name: string;
  color: string;
}

const UGI_META: ReadonlyArray<{ id: number; color: string }> = [
  { id: 1, color: "#2E5BFF" },
  { id: 2, color: "#4A82FF" },
  { id: 3, color: "#5B9BD5" },
  { id: 4, color: "#6AB0B5" },
  { id: 5, color: "#7EC8A0" },
  { id: 6, color: "#A8D65A" },
  { id: 7, color: "#D4C840" },
  { id: 8, color: "#E5A030" },
  { id: 9, color: "#FF7A2E" },
];

function toUgiLevel(t: TranslateFn, id: number, color: string): UGILevel {
  return { id, code: t(`ugi.l${id}.code`), name: t(`ugi.l${id}.name`), color };
}

/** Localised UGI levels. */
export function getUgiLevels(t: TranslateFn): UGILevel[] {
  return UGI_META.map((meta) => toUgiLevel(t, meta.id, meta.color));
}

export interface UGSLevel {
  id: number;
  code: string;
  name: string;
  range: string;
  color: string;
}

const UGS_META: ReadonlyArray<{ id: number; range: string; color: string }> = [
  { id: 1, range: "0.10—0.39", color: "#2E5BFF" },
  { id: 2, range: "0.40—0.59", color: "#5B9BD5" },
  { id: 3, range: "0.60—0.79", color: "#A8D65A" },
  { id: 4, range: "0.70—0.89", color: "#E5A030" },
  { id: 5, range: "0.90—1.00", color: "#FF7A2E" },
];

function toUgsLevel(t: TranslateFn, id: number, range: string, color: string): UGSLevel {
  return { id, code: t(`ugs.l${id}.code`), name: t(`ugs.l${id}.name`), range, color };
}

/** Localised UGS levels. */
export function getUgsLevels(t: TranslateFn): UGSLevel[] {
  return UGS_META.map((meta) => toUgsLevel(t, meta.id, meta.range, meta.color));
}

export interface TransitionDoc {
  name: string;
  template: string;
  description: string;
}

export interface TransitionRisk {
  risk: string;
  solution: string;
  probability: "low" | "medium" | "high";
}

export interface RoadmapTransition {
  from: number;
  to: number;
  title: string;
  actions: string[];
  documents: TransitionDoc[];
  risks: TransitionRisk[];
  estimatedTime: string;
}

/** Non-textual transition metadata (month estimates for planning). */
const TRANSITION_META: ReadonlyArray<{ from: number; to: number; monthsMin: number; monthsMax: number }> = [
  { from: 1, to: 2, monthsMin: 1, monthsMax: 2 },
  { from: 2, to: 3, monthsMin: 1, monthsMax: 2 },
  { from: 3, to: 4, monthsMin: 1, monthsMax: 2 },
  { from: 4, to: 5, monthsMin: 1, monthsMax: 3 },
  { from: 5, to: 6, monthsMin: 2, monthsMax: 3 },
  { from: 6, to: 7, monthsMin: 2, monthsMax: 3 },
  { from: 7, to: 8, monthsMin: 2, monthsMax: 3 },
  { from: 8, to: 9, monthsMin: 2, monthsMax: 4 },
];

/** Curated transition risk probabilities mirror the legacy table. */
function transitionProbability(from: number, riskIndex: number): TransitionRisk["probability"] {
  if (from === 8 && riskIndex === 1) return "low";
  const high: ReadonlyArray<readonly [number, number]> = [
    [1, 1], [2, 1], [3, 1], [4, 0], [5, 1], [6, 0], [7, 1],
  ];
  return high.some(([f, r]) => f === from && r === riskIndex) ? "high" : "medium";
}

function toTransition(t: TranslateFn, from: number, to: number): RoadmapTransition {
  const base = `transitions.from${from}to${to}`;
  const templates = protocol().transitionDocTemplates[`from${from}to${to}`] ?? [];
  const docsCount = arrLen(t, `${base}.docs`);
  const risksCount = arrLen(t, `${base}.risks`);
  return {
    from,
    to,
    title: t(`${base}.title`),
    actions: strArr(t, `${base}.actions`),
    documents: Array.from({ length: docsCount }, (_, i) => ({
      name: t(`${base}.docs.${i}.name`),
      template: templates[i] ?? "",
      description: t(`${base}.docs.${i}.description`),
    })),
    risks: Array.from({ length: risksCount }, (_, i) => ({
      risk: t(`${base}.risks.${i}.risk`),
      solution: t(`${base}.risks.${i}.solution`),
      probability: transitionProbability(from, i),
    })),
    estimatedTime: t(`${base}.estimatedTime`),
  };
}

/** Localised roadmap transitions. */
export function getRoadmapTransitions(t: TranslateFn): RoadmapTransition[] {
  return TRANSITION_META.map((meta) => toTransition(t, meta.from, meta.to));
}

/** Non-textual month estimates for a transition (planning math without parsing text). */
export function getTransitionMonths(from: number, to: number): { min: number; max: number } | null {
  const meta = TRANSITION_META.find((m) => m.from === from && m.to === to);
  return meta ? { min: meta.monthsMin, max: meta.monthsMax } : null;
}

// ─── Deprecated compat shims (tasks 02–05 remove as screens migrate) ───────
// Same names and shapes as before; every access resolves through the CURRENT
// locale translator (no RU default). Prefer the get* resolvers above.

/** @deprecated use getUgtLevels(t) with a current-locale translator. */
export const UGT_LEVELS: UGTLevel[] = shimList("ugt", (t) => getUgtLevels(t));

/** @deprecated use getUgpLevels(t) with a current-locale translator. */
export const UGP_LEVELS: UGPLevel[] = shimList("ugt", (t) => getUgpLevels(t));

/** @deprecated use getUgiLevels(t) with a current-locale translator. */
export const UGI_LEVELS: UGILevel[] = shimList("ugt", (t) => getUgiLevels(t));

/** @deprecated use getUgsLevels(t) with a current-locale translator. */
export const UGS_LEVELS: UGSLevel[] = shimList("ugt", (t) => getUgsLevels(t));

/** @deprecated use getRoadmapTransitions(t) with a current-locale translator. */
export const ROADMAP_TRANSITIONS: RoadmapTransition[] = shimList("ugt", (t) =>
  getRoadmapTransitions(t),
);
