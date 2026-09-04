/**
 * Single product model (ticket 01, R17, G14, G30).
 * One place keeps the schema in sync: tasks 02-08 import from here.
 * Display strings live in the taxonomy dictionary (next-intl); this module
 * holds only key metadata plus resolvers taking a translator function.
 */

import type { ProjectStatus } from "./status";
import ruMessages from "../messages/ru.json" with { type: "json" };

/** Translator function shape (next-intl scoped translator is compatible via adapter, see below). */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Adapter for a next-intl scoped translator, e.g.:
 *   const t = useTranslations("taxonomy");
 *   getProjectTags((key, params) => t(key as never, params as never));
 * The cast is needed because next-intl types keys as a closed union.
 */
export function asTranslateFn(
  t: (key: never, params?: Record<string, string | number>) => string,
): TranslateFn {
  return (key, params) => t(key as never, params);
}

interface TaxonomyDict {
  tags: string[];
  validation: { minTags: string; maxTags: string; unknownTags: string };
  legacy: { nioktr: string; software: string; hardware: string; infosystems: string };
}

function taxonomyDict(): TaxonomyDict {
  return (ruMessages as unknown as { taxonomy: TaxonomyDict }).taxonomy;
}

/** Fill {param} placeholders of a dictionary template (no string glue in callers). */
function fill(template: string, params: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

// ─── Tag catalogue — 32 standardised topics (G14, R20) ──────────────────────

/**
 * 32 standardised project tags (multi-tag 1-5).
 * Canonical values come from taxonomy.tags (RU dictionary); English labels
 * resolve through getProjectTags / getTagLabel with a taxonomy translator.
 */
export const PROJECT_TAGS: readonly string[] = taxonomyDict().tags;

export type ProjectTag = (typeof PROJECT_TAGS)[number];

export const TAGS_MIN = 1;
export const TAGS_MAX = 5;

/** Tag index by canonical RU value (stable positions in taxonomy.tags). */
const TAG_INDEX_BY_VALUE: ReadonlyMap<string, number> = new Map(
  PROJECT_TAGS.map((tag, index) => [tag, index] as [string, number]),
);

/** Legacy backend category value -> canonical tag index (no literals in code). */
const LEGACY_TAG_SLUGS: ReadonlyArray<readonly [keyof TaxonomyDict["legacy"], number]> = [
  ["nioktr", 11],
  ["software", 19],
  ["hardware", 13],
  ["infosystems", 19],
];
const LEGACY_TAG_INDEX: ReadonlyMap<string, number> = new Map(
  LEGACY_TAG_SLUGS.map(([slug, index]) => [taxonomyDict().legacy[slug], index]),
);

export function isValidTags(tags: string[]): boolean {
  if (tags.length < TAGS_MIN || tags.length > TAGS_MAX) return false;
  // every tag must come from the catalogue
  return tags.every((t) => (PROJECT_TAGS as readonly string[]).includes(t));
}

export function validateTags(tags: string[]): string | null {
  const v = taxonomyDict().validation;
  if (tags.length < TAGS_MIN) return fill(v.minTags, { min: TAGS_MIN });
  if (tags.length > TAGS_MAX) return fill(v.maxTags, { max: TAGS_MAX });
  const invalid = tags.filter((t) => !(PROJECT_TAGS as readonly string[]).includes(t));
  if (invalid.length) return fill(v.unknownTags, { list: invalid.join(", ") });
  return null;
}

/** Localised tag validation via dictionary params (preferred in screens). */
export function validateTagsT(t: TranslateFn, tags: string[]): string | null {
  if (tags.length < TAGS_MIN) return t("validation.minTags", { min: TAGS_MIN });
  if (tags.length > TAGS_MAX) return t("validation.maxTags", { max: TAGS_MAX });
  const invalid = tags.filter((tag) => !TAG_INDEX_BY_VALUE.has(tag));
  if (invalid.length) return t("validation.unknownTags", { list: invalid.join(", ") });
  return null;
}

/** Localised labels for the whole catalogue, in canonical order. */
export function getProjectTags(t: TranslateFn): string[] {
  return PROJECT_TAGS.map((_, index) => t(`tags.${index}`));
}

/** Localised label for one canonical tag value; unknown values pass through. */
export function getTagLabel(t: TranslateFn, tag: string): string {
  const index = TAG_INDEX_BY_VALUE.get(tag);
  return index === undefined ? tag : t(`tags.${index}`);
}

/**
 * tags <-> category mapping for backend compatibility.
 * Backend stores category: string | null (single), front uses tags 1-5.
 * On submit tags[0] becomes category.
 */
export function tagsToCategory(tags: string[]): string | null {
  if (!tags.length) return null;
  return tags[0];
}

export function categoryToTags(category: string | null | undefined): string[] {
  if (!category) return [];
  // a catalogue value maps to a single tag, otherwise keep as fallback tag
  if ((PROJECT_TAGS as readonly string[]).includes(category)) return [category];
  // legacy categories map to the closest catalogue tag (by index, see above)
  const legacyIndex = LEGACY_TAG_INDEX.get(category);
  if (legacyIndex !== undefined) return [PROJECT_TAGS[legacyIndex]];
  return [category];
}

// ─── Project ────────────────────────────────────────────────────────────────

/**
 * Full project card (single type for all dashboards).
 * Compatible with backend ProjectOut plus front tags extension.
 */
export interface ProjectCardOut {
  id: number;
  name: string;
  description: string | null;
  /** Backend legacy field — front uses tags, kept for compatibility */
  category: string | null;
  /** 1-5 catalogue tags */
  tags: string[];
  target_level: number;
  current_level: number;
  preliminary_level: number | null;
  status: ProjectStatus | string;
  budget: number | null;
  organization: string | null;
  is_public: boolean;
  show_preliminary: boolean;
  published_at: string | null;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
  join_token: string | null;
  // legal fields (ticket 04)
  legal_owner?: string | null;
  rights_holder?: string | null;
  contract_number?: string | null;
  contract_basis?: string | null;
}

/**
 * Lightweight registry entry (public showcase).
 * Compatible with backend RegistryProjectOut.
 */
export interface RegistryProjectOut {
  id: number;
  name: string;
  description?: string | null;
  category: string | null;
  tags: string[];
  current_level: number;
  preliminary_level: number | null;
  target_level: number;
  budget: number | null;
  organization: string | null;
  is_public: boolean;
  show_preliminary: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
  status?: ProjectStatus;
}

export interface RegistryParams {
  search?: string;
  tags?: string[];
  category?: string;
  ugt_min?: number;
  ugt_max?: number;
  status?: string;
  region?: string;
  budget_min?: number;
  budget_max?: number;
  after_id?: number;
  limit?: number;
}

// ─── Organizations ──────────────────────────────────────────────────────────

export interface OrganizationOut {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  org_type: string | null;
  competencies: string[];
  projects_count: number;
  region: string | null;
  created_at?: string | null;
}

// Compatibility with the legacy OrganizationDetailOut type
export interface OrganizationDetailOut extends OrganizationOut {
  nioktr_cards?: NioktrCardOut[];
}

export interface NioktrCardOut {
  id: number;
  registration_number: string;
  name: string;
  annotation: string | null;
  keywords: string[];
  nioktr_types: string[];
  executor_name: string | null;
  customer_name: string | null;
  created_date: string | null;
  is_ai_area: boolean;
}

// ─── Documents ──────────────────────────────────────────────────────────────

export interface DocumentOut {
  id: number;
  project_id: number;
  title: string;
  doc_type: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  sha256: string | null;
  scan_status: string;
  scan_result?: string | null;
  version: number;
  uploaded_by: number | null;
  created_at: string | null;
  file_url?: string | null;
  // Compatibility with ProjectDocumentOut (title/doc_type/status)
  status?: string;
}

export interface VerificationDocumentOut {
  id: number;
  project_id: number;
  uploader_id: number;
  uploader_name: string | null;
  title: string;
  comment: string | null;
  file_ref: string | null;
  created_at: string | null;
}

// ─── Members / teams ────────────────────────────────────────────────────────

export interface ProjectMemberOut {
  id: number;
  project_id: number;
  user_id: number;
  role_in_project: string;
  status: string;
  is_priority: boolean;
  is_project_admin?: boolean;
  joined_at?: string | null;
}

export interface ControlPointOut {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  point_type: string;
  status: string;
  decision: string | null;
  decided_by: number | null;
}

export interface QuestionnaireResultOut {
  id: number;
  project_id: number;
  level_id: number;
  checked_items: string[];
  percentage: number;
  user_id: number | null;
  members_count?: number | null;
}

export interface AuditTrailEntryOut {
  id: number;
  project_id: number | null;
  user_id: number | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface ProjectDetailOut {
  project: ProjectCardOut;
  questionnaire_results: QuestionnaireResultOut[];
  control_points: ControlPointOut[];
  documents: DocumentOut[];
  verification_documents: VerificationDocumentOut[];
  members: ProjectMemberOut[];
  audit_trail: AuditTrailEntryOut[];
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface NotificationOut {
  id: number;
  type: string;
  title: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string | null;
}

// ─── Matching ───────────────────────────────────────────────────────────────

export interface MatchingIn {
  title: string;
  annotation?: string | null;
  sector?: string | null;
  ugt_level?: number | null;
  region?: string | null;
  competencies: string[];
}

export interface MatchCandidate {
  id: number;
  name: string;
  org_type: string | null;
  region: string | null;
  competencies: string[];
  reason: string;
  score: number | null;
}

export interface MatchOut {
  query: MatchingIn;
  results: MatchCandidate[];
  method: string;
  queue: string;
}

// ─── Compatibility helpers ──────────────────────────────────────────────────

/** Backend ProjectOut -> frontend ProjectCardOut (adds tags from category) */
export function normalizeProjectCard(raw: Record<string, unknown>): ProjectCardOut {
  const category = (raw["category"] as string | null) ?? null;
  const tagsRaw = raw["tags"] as string[] | undefined;
  const tags = tagsRaw && tagsRaw.length ? tagsRaw : categoryToTags(category);
  return {
    id: raw["id"] as number,
    name: raw["name"] as string,
    description: (raw["description"] as string | null) ?? null,
    category,
    tags,
    target_level: (raw["target_level"] as number) ?? 9,
    current_level: (raw["current_level"] as number) ?? 0,
    preliminary_level: (raw["preliminary_level"] as number | null) ?? null,
    status: (raw["status"] as ProjectStatus) ?? "draft",
    budget: (raw["budget"] as number | null) ?? null,
    organization: (raw["organization"] as string | null) ?? null,
    is_public: Boolean(raw["is_public"]),
    show_preliminary: Boolean(raw["show_preliminary"]),
    published_at: (raw["published_at"] as string | null) ?? null,
    created_by: (raw["created_by"] as number | null) ?? null,
    created_at: (raw["created_at"] as string | null) ?? null,
    updated_at: (raw["updated_at"] as string | null) ?? null,
    join_token: (raw["join_token"] as string | null) ?? null,
    legal_owner: (raw["legal_owner"] as string | null) ?? null,
    rights_holder: (raw["rights_holder"] as string | null) ?? null,
    contract_number: (raw["contract_number"] as string | null) ?? null,
    contract_basis: (raw["contract_basis"] as string | null) ?? null,
  };
}

export function normalizeRegistryProject(raw: Record<string, unknown>): RegistryProjectOut {
  const category = (raw["category"] as string | null) ?? null;
  const tagsRaw = raw["tags"] as string[] | undefined;
  const tags = tagsRaw && tagsRaw.length ? tagsRaw : categoryToTags(category);
  return {
    id: raw["id"] as number,
    name: raw["name"] as string,
    description: (raw["description"] as string | null) ?? null,
    category,
    tags,
    current_level: (raw["current_level"] as number) ?? 0,
    preliminary_level: (raw["preliminary_level"] as number | null) ?? null,
    target_level: (raw["target_level"] as number) ?? 9,
    budget: (raw["budget"] as number | null) ?? null,
    organization: (raw["organization"] as string | null) ?? null,
    is_public: Boolean(raw["is_public"]),
    show_preliminary: Boolean(raw["show_preliminary"]),
    published_at: (raw["published_at"] as string | null) ?? null,
    created_at: (raw["created_at"] as string | null) ?? null,
    updated_at: (raw["updated_at"] as string | null) ?? null,
    status: raw["status"] as ProjectStatus | undefined,
  };
}

/** Payload for project create/update (tags[0] -> category) */
export function denormalizeProjectInput(input: Partial<ProjectCardOut> & { tags?: string[] }): Record<string, unknown> {
  const tags = input.tags;
  const category = tags && tags.length ? tagsToCategory(tags) : input.category ?? null;
  return {
    name: input.name,
    description: input.description,
    category,
    target_level: input.target_level,
    budget: input.budget,
  };
}
