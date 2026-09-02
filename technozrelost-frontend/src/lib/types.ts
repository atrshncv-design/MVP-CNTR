/**
 * Единая модель продукта (тикет 01, R17, G14, G30).
 * Почему единый файл: 7 дублей Project в разных папках расходились по полям
 * (category vs tags, бюджет number vs string) и ломали реестры. Теперь схема
 * синхронизируется одним местом — все таски 02-08 импортируют отсюда.
 */

import type { ProjectStatus } from "./status";

// ─── Справочник тегов — 32 стандартизированные темы (G14, R20) ─────────────

/**
 * 32 стандартизированных тега проектов (мультитег 1-5).
 * Почему 32: интервью 4.2 требует «большой набор, но стандартизированных
 * тем — 30+» для удобной работы с реестрами. Один проект может иметь
 * одновременно AI и медицину — теги выбираются чипами.
 */
export const PROJECT_TAGS: readonly string[] = [
  "AI/ML",
  "Машинное зрение",
  "Обработка языка",
  "Робототехника",
  "Биотех",
  "Медицина",
  "Фарма",
  "Энергетика",
  "Нефтегаз",
  "Материаловедение",
  "Композиты",
  "Промышленные технологии",
  "Аддитивные технологии",
  "Электроника",
  "Микроэлектроника",
  "Квантовые технологии",
  "Фотоника",
  "Водородные технологии",
  "Аккумуляторы",
  "IT-системы",
  "Кибербезопасность",
  "Транспорт",
  "АПК",
  "Аэрокосмос",
  "Машиностроение",
  "Химия",
  "Строительство",
  "Охрана окружения",
  "Логистика",
  "Образование",
  "Финансовые технологии",
  "Телеком",
] as const;

export type ProjectTag = (typeof PROJECT_TAGS)[number];

export const TAGS_MIN = 1;
export const TAGS_MAX = 5;

export function isValidTags(tags: string[]): boolean {
  if (tags.length < TAGS_MIN || tags.length > TAGS_MAX) return false;
  // все теги должны быть из справочника
  return tags.every((t) => (PROJECT_TAGS as readonly string[]).includes(t));
}

export function validateTags(tags: string[]): string | null {
  if (tags.length < TAGS_MIN) return `Выберите хотя бы ${TAGS_MIN} тег`;
  if (tags.length > TAGS_MAX) return `Можно выбрать не более ${TAGS_MAX} тегов`;
  const invalid = tags.filter((t) => !(PROJECT_TAGS as readonly string[]).includes(t));
  if (invalid.length) return `Неизвестные теги: ${invalid.join(", ")}`;
  return null;
}

/**
 * Маппинг tags ↔ category для совместимости с бэком.
 * Бэк пока хранит category: string | null (одна категория), фронт —
 * tags: string[] (1-5). При отправке берём tags[0] как category.
 */
export function tagsToCategory(tags: string[]): string | null {
  if (!tags.length) return null;
  return tags[0];
}

export function categoryToTags(category: string | null | undefined): string[] {
  if (!category) return [];
  // если категория совпадает со справочником — один тег, иначе всё равно возвращаем как тег-фолбэк
  if ((PROJECT_TAGS as readonly string[]).includes(category)) return [category];
  // для легаси категорий вроде "НИОКТР" / "Программное обеспечение" маппим на ближайший тег
  const legacyMap: Record<string, string> = {
    НИОКТР: "Промышленные технологии",
    "Программное обеспечение": "IT-системы",
    "Аппаратные средства": "Электроника",
    "Информационные системы": "IT-системы",
  };
  if (legacyMap[category]) return [legacyMap[category]];
  return [category];
}

// ─── Проект ────────────────────────────────────────────────────────────────

/**
 * Полная карточка проекта (единый тип для всех ЛК, карточки УГТ 15 блоков, истории 8-14).
 * Поля совместимы с backend ProjectOut + frontend-расширение tags.
 */
export interface ProjectCardOut {
  id: number;
  name: string;
  description: string | null;
  /** Legacy поле backend — фронт использует tags, но держим для совместимости */
  category: string | null;
  /** 1-5 тегов из справочника PROJECT_TAGS */
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
  // юридические поля (тикет 04)
  legal_owner?: string | null;
  rights_holder?: string | null;
  contract_number?: string | null;
  contract_basis?: string | null;
}

/**
 * Лёгкая запись реестра (публичная витрина, истории 18, 20-26).
 * Совместима с backend RegistryProjectOut.
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

// ─── Организации ──────────────────────────────────────────────────────────

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

// Совместимость со старым типом OrganizationDetailOut
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

// ─── Документы ────────────────────────────────────────────────────────────

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
  // Для совместимости с ProjectDocumentOut (title/doc_type/status)
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

// ─── Участники / команды ─────────────────────────────────────────────────

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

// ─── Уведомления ──────────────────────────────────────────────────────────

export interface NotificationOut {
  id: number;
  type: string;
  title: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string | null;
}

// ─── Мэтчинг ──────────────────────────────────────────────────────────────

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

// ─── Хелперы совместимости ───────────────────────────────────────────────

/** Преобразование backend ProjectOut → frontend ProjectCardOut (добавляет tags из category) */
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

/** Подготовка payload для создания/обновления проекта (tags[0] → category) */
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
