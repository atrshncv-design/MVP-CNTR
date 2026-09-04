/**
 * UGT/UGP/UGI/UGS methodology content (GOST R 58048-2017).
 * Display strings live in the ugt dictionary (next-intl); this module holds
 * only key metadata (ids, colors, ranges, month estimates) plus resolvers
 * taking a translator function scoped to the ugt namespace.
 * Compat exports below resolve through the RU dictionary, so existing
 * screens keep working until they migrate to the resolvers.
 */

import type { TranslateFn } from "./types";
import ruMessages from "../messages/ru.json" with { type: "json" };

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

interface DictDoc {
  name: string;
  template: string;
  description: string;
}

interface DictLevel {
  code: string;
  name: string;
  short: string;
  description: string;
  requirements: string[];
  deliverables: string[];
  docs: DictDoc[];
  kpi: { publications: string; patents: string; prototype: string };
  risks: { risk: string; solution: string }[];
}

interface DictNamed {
  code: string;
  name: string;
}

interface DictTransition {
  title: string;
  actions: string[];
  docs: DictDoc[];
  risks: { risk: string; solution: string }[];
  estimatedTime: string;
}

interface UgtDict {
  levels: Record<string, DictLevel>;
  kpiLabels: { publications: string; patents: string; prototype: string };
  ugp: Record<string, DictNamed>;
  ugi: Record<string, DictNamed>;
  ugs: Record<string, DictNamed>;
  transitions: Record<string, DictTransition>;
}

function ugtDict(): UgtDict {
  return (ruMessages as unknown as { ugt: UgtDict }).ugt;
}

/** Dot-path lookup over the RU ugt dictionary (compat path only). */
function lookupRu(path: string): string {
  const parts = path.split(".");
  let cur: unknown = ugtDict();
  for (const part of parts) {
    if (Array.isArray(cur)) cur = cur[Number(part)];
    else if (cur !== null && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else return "";
  }
  return typeof cur === "string" ? cur : "";
}

const ruT: TranslateFn = (key) => lookupRu(key);

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

const UGT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Entry counts are structural (ru/en parity is asserted by tests). */
function levelCounts(id: number): { req: number; deliv: number; docs: number; risks: number } {
  const ref = ugtDict().levels[`l${id}`];
  return { req: ref.requirements.length, deliv: ref.deliverables.length, docs: ref.docs.length, risks: ref.risks.length };
}

function toUgtLevel(t: TranslateFn, id: number): UGTLevel {
  const base = `levels.l${id}`;
  const n = levelCounts(id);
  const ref = ugtDict().levels[`l${id}`];
  return {
    id,
    code: t(`${base}.code`),
    name: t(`${base}.name`),
    short: t(`${base}.short`),
    description: t(`${base}.description`),
    color: UGT_META[id - 1].color,
    requirements: Array.from({ length: n.req }, (_, i) => t(`${base}.requirements.${i}`)),
    deliverables: Array.from({ length: n.deliv }, (_, i) => t(`${base}.deliverables.${i}`)),
    deliverableDocs: Array.from({ length: n.docs }, (_, i) => ({
      name: t(`${base}.docs.${i}.name`),
      template: ref.docs[i].template,
      description: t(`${base}.docs.${i}.description`),
    })),
    kpi: {
      [t("kpiLabels.publications")]: t(`${base}.kpi.publications`),
      [t("kpiLabels.patents")]: t(`${base}.kpi.patents`),
      [t("kpiLabels.prototype")]: t(`${base}.kpi.prototype`),
    },
    risks: Array.from({ length: n.risks }, (_, i) => ({
      risk: t(`${base}.risks.${i}.risk`),
      solution: t(`${base}.risks.${i}.solution`),
      probability: levelProbability(id, i),
    })),
  };
}

/** Compat: UGT levels resolved through the RU dictionary (same values as before). */
export const UGT_LEVELS: UGTLevel[] = UGT_IDS.map((id) => toUgtLevel(ruT, id));

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

/** Compat: UGP levels resolved through the RU dictionary. */
export const UGP_LEVELS: UGPLevel[] = UGP_META.map((meta) => toUgpLevel(ruT, meta.id, meta.color));

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

/** Compat: UGI levels resolved through the RU dictionary. */
export const UGI_LEVELS: UGILevel[] = UGI_META.map((meta) => toUgiLevel(ruT, meta.id, meta.color));

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

/** Compat: UGS levels resolved through the RU dictionary. */
export const UGS_LEVELS: UGSLevel[] = UGS_META.map((meta) =>
  toUgsLevel(ruT, meta.id, meta.range, meta.color),
);

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
  const ref = ugtDict().transitions[`from${from}to${to}`];
  return {
    from,
    to,
    title: t(`${base}.title`),
    actions: ref.actions.map((_, i) => t(`${base}.actions.${i}`)),
    documents: ref.docs.map((d, i) => ({
      name: t(`${base}.docs.${i}.name`),
      template: d.template,
      description: t(`${base}.docs.${i}.description`),
    })),
    risks: ref.risks.map((_, i) => ({
      risk: t(`${base}.risks.${i}.risk`),
      solution: t(`${base}.risks.${i}.solution`),
      probability: transitionProbability(from, i),
    })),
    estimatedTime: t(`${base}.estimatedTime`),
  };
}

/** Compat: roadmap transitions resolved through the RU dictionary. */
export const ROADMAP_TRANSITIONS: RoadmapTransition[] = TRANSITION_META.map((meta) =>
  toTransition(ruT, meta.from, meta.to),
);

/** Localised roadmap transitions. */
export function getRoadmapTransitions(t: TranslateFn): RoadmapTransition[] {
  return TRANSITION_META.map((meta) => toTransition(t, meta.from, meta.to));
}

/** Non-textual month estimates for a transition (planning math without parsing text). */
export function getTransitionMonths(from: number, to: number): { min: number; max: number } | null {
  const meta = TRANSITION_META.find((m) => m.from === from && m.to === to);
  return meta ? { min: meta.monthsMin, max: meta.monthsMax } : null;
}
