/**
 * T-004. Доменные типы платформы ЦНТР УР.
 *
 * Слой данных: UI → route loaders → typed domain data layer → PlatformDataAdapter.
 * Компоненты НЕ знают об источнике данных. Типы соответствуют DATA-CONTRACTS §3–4
 * и STATES.md (единый словарь статусов).
 *
 * Политика реальности (DATA-CONTRACTS §2): публичные примеры — реальные данные
 * или честные пустые состояния. Контролируемые UI-фикстуры (isFixture: true +
 * label «Тестовый пример для проверки интерфейса») допустимы ТОЛЬКО в
 * авторизованных кабинетах и НИКОГДА не попадают в публичные методы адаптера.
 */

import type { VisibilityScope } from "./adapter/types.ts";

/* ------------------------------------------------------------------ */
/* Статусы (STATES.md §1)                                              */
/* ------------------------------------------------------------------ */

/** Канонический статус доменного объекта (STATES.md §1). */
export type Status =
  | "draft"
  | "action_required"
  | "under_review"
  | "clarification"
  | "approval"
  | "approved"
  | "rejected"
  | "published"
  | "active"
  | "blocked"
  | "archived"
  | "closed";

/** Русские подписи канонических статусов (STATES.md §1). */
export const STATUS_LABELS: Record<Status, string> = {
  draft: "Черновик",
  action_required: "Нужно действие",
  under_review: "На проверке",
  clarification: "Нужны уточнения",
  approval: "На согласовании",
  approved: "Одобрено",
  rejected: "Отклонено",
  published: "Опубликовано",
  active: "В работе",
  blocked: "Заблокировано",
  archived: "Архив",
  closed: "Завершено",
};

/** Все канонические статусы в порядке STATES.md. */
export const STATUSES: readonly Status[] = [
  "draft",
  "action_required",
  "under_review",
  "clarification",
  "approval",
  "approved",
  "rejected",
  "published",
  "active",
  "blocked",
  "archived",
  "closed",
];

/* ------------------------------------------------------------------ */
/* Роли                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Роли платформы (ROLES.md matrix). Публичный посетитель — «visitor»;
 * остальные соответствуют ролевой матрице. Демо-аккаунты бэкенда
 * (mock-сессия P0) маппятся: gk_customer → customer, rd_executor → partner,
 * cntr_manager → center_manager, cntr_admin → center_admin, investor → investor.
 */
export type Role =
  | "visitor"
  | "customer"
  | "partner"
  | "science"
  | "manufacturer"
  | "investor"
  | "expert"
  | "center_employee"
  | "center_manager"
  | "center_admin"
  | "regulator";

export const ROLE_LABELS: Record<Role, string> = {
  visitor: "Публичный посетитель",
  customer: "Заказчик",
  partner: "Промышленный партнёр / исполнитель",
  science: "Научная организация",
  manufacturer: "Серийный производитель",
  investor: "Инвестор",
  expert: "Эксперт / аудитор",
  center_employee: "Сотрудник Центра",
  center_manager: "Менеджер Центра",
  center_admin: "Администратор Центра",
  regulator: "Регулирующая организация",
};

/* ------------------------------------------------------------------ */
/* УГТ (ГОСТ Р 58048-2017)                                             */
/* ------------------------------------------------------------------ */

/** Диапазон уровня готовности технологии. */
export type UgtBand = "low" | "medium" | "high";

export const UGT_BAND_LABELS: Record<UgtBand, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

/** Уровень УГТ 1–9 (названия по ГОСТ Р 58048-2017). */
export interface UgtLevelInfo {
  number: number;
  code: string;
  name: string;
  short: string;
  band: UgtBand;
}

/** Измерение готовности (ось оценки). */
export interface UgtDimension {
  id: string;
  label: string;
  description: string;
}

/** Методология УГТ: уровни, диапазоны, измерения, правила перехода. */
export interface UgtMethodology {
  levels: UgtLevelInfo[];
  bands: UgtBandInfo[];
  dimensions: UgtDimension[];
  transition: {
    description: string;
    maxGainPerReview: number;
    evidenceRequired: boolean;
    reportPathYears: number;
  };
  source: string;
}

export interface UgtBandInfo {
  band: UgtBand;
  label: string;
  range: [number, number];
}

/* ------------------------------------------------------------------ */
/* Происхождение данных (provenance)                                   */
/* ------------------------------------------------------------------ */

/**
 * Происхождение записи: откуда пришли данные. Для реальных записей НИОКТР —
 * источник «МИНОБРНАУКИ России» и дата импорта из файла-фикстуры.
 * Поля не фабрикуются: отсутствующие значения — null.
 */
export interface ResearchProvenance {
  source: string;
  importedAt: string | null;
  sourceUrl: string | null;
}

/* ------------------------------------------------------------------ */
/* Сырые данные НИОКТР (формат бэкенда data/nioktr_sample.json)        */
/* ------------------------------------------------------------------ */

/** Организация в карточке НИОКТР (исполнитель/заказчик). */
export interface NioktrOrganization {
  name: string;
  short_name: string;
  ogrn?: string | null;
  organization_type?: string | null;
  region?: string | null;
}

/** Карточка НИОКТР в исходном формате бэкенда (все поля сохраняются). */
export interface NioktrCard {
  registration_number: string;
  name: string;
  annotation: string;
  keywords: string[];
  nioktr_types: string[];
  state_program: string | null;
  created_date: string;
  is_ai_area: boolean;
  is_ai_usage: boolean;
  executor: NioktrOrganization;
  customer: NioktrOrganization;
}

/** Файл-фикстура реальных данных: {cards: [...]} + provenance на верхнем уровне. */
export interface NioktrDataset {
  cards: NioktrCard[];
  provenance?: {
    source: string;
    sourceFile?: string;
    cardCount?: number;
    importedAt?: string;
  };
}

/* ------------------------------------------------------------------ */
/* Фикстуры UI                                                        */
/* ------------------------------------------------------------------ */

/**
 * Метка контролируемой UI-фикстуры. Все записи-фикстуры несут
 * `isFixture: true` и `label: "Тестовый пример для проверки интерфейса"`.
 * Такие записи доступны ТОЛЬКО в авторизованных кабинетах (workspace,
 * операционные очереди, dossier в scope ≠ public) и никогда не попадают
 * в публичные методы адаптера.
 */
export interface FixtureMarker {
  isFixture: true;
  label: string;
}

export const FIXTURE_LABEL = "Тестовый пример для проверки интерфейса";

export const fixtureMarker = (): FixtureMarker => ({
  isFixture: true,
  label: FIXTURE_LABEL,
});

/** Тип-гард: запись помечена как контролируемая UI-фикстура. */
export function isFixtureRecord(value: unknown): value is FixtureMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { isFixture?: unknown }).isFixture === true &&
    (value as { label?: unknown }).label === FIXTURE_LABEL
  );
}

/* ------------------------------------------------------------------ */
/* Технологии (TechnologySummary / TechnologyDossier, DATA-CONTRACTS §4) */
/* ------------------------------------------------------------------ */

/** Карточка технологии в списках/реестрах. */
export interface TechnologySummary extends Partial<FixtureMarker> {
  id: string;
  title: string;
  shortDescription: string;
  industry: string | null;
  organizationName: string;
  ugtLevel: number;
  ugtBand: UgtBand;
  verificationStatus: Status;
  publicationStatus: Status;
  lastUpdatedAt: string;
  /** Только если реально известно (не фабрикуется). */
  availableEvidenceCount?: number;
  /** Только если реально существует или явно заменяемо. */
  imageOrVisualReference?: string;
}

/** Команда/партнёр технологии (там, где разрешено показывать). */
export interface TechnologyParty {
  name: string;
  role: string;
}

/** Запись в истории УГТ технологии. */
export interface UgtHistoryEntry {
  level: number;
  date: string | null;
  actor: string;
  decision: Status;
}

/** Оценка по одному измерению готовности. */
export interface ReadinessDimensionScore {
  dimension: string;
  score: number;
  summary: string;
}

/** Контрольная точка пути N → N+1. */
export interface TechnologyCheckpoint {
  id: string;
  level: number;
  title: string;
  status: Status;
  dueDate: string | null;
  evidenceCount: number;
}

/** Свидетельство (evidence) технологии. */
export interface TechnologyEvidence {
  id: string;
  title: string;
  kind: string;
  status: Status;
  uploadedAt: string | null;
}

/** Документ технологии. */
export interface TechnologyDocument {
  id: string;
  title: string;
  kind: string;
  status: Status;
}

/** Связанный запрос заказчика и степень соответствия. */
export interface TechnologyMatch {
  requestId: string;
  title: string;
  matchScore: number | null;
}

/** Полное досье технологии. */
export interface TechnologyDossier extends Partial<FixtureMarker> {
  id: string;
  title: string;
  shortDescription: string;
  problem: string;
  solution: string;
  applicationAreas: string[];
  industries: string[];
  organization: {
    name: string;
    region: string | null;
    role: string;
  };
  /** null, если показ команды/партнёров не разрешён. */
  teamAndPartners: TechnologyParty[] | null;
  ugt: {
    currentLevel: number;
    band: UgtBand;
    verificationDate: string | null;
    history: UgtHistoryEntry[];
  };
  readiness: ReadinessDimensionScore[];
  checkpoints: TechnologyCheckpoint[];
  evidence: TechnologyEvidence[];
  documents: TechnologyDocument[];
  customerRequestsAndMatches: TechnologyMatch[];
  pilots: Pilot[];
  decisionHistory: Decision[];
  visibility: {
    scope: VisibilityScope;
    publicationStatus: Status;
    publishedAt: string | null;
    updatedAt: string;
  };
}

/* ------------------------------------------------------------------ */
/* Запросы заказчиков (CustomerRequest, DATA-CONTRACTS §4)             */
/* ------------------------------------------------------------------ */

/** Карточка запроса в списках. */
export interface CustomerRequestSummary extends Partial<FixtureMarker> {
  id: string;
  title: string;
  problemStatement: string;
  customerOrganization: string;
  industry: string | null;
  status: Status;
  publicationStatus: Status;
  createdAt: string;
  /** Только если реально известен срок. */
  deadline: string | null;
}

/** Полный запрос заказчика. */
export interface CustomerRequest extends Partial<FixtureMarker> {
  id: string;
  title: string;
  problemStatement: string;
  customerOrganization: string;
  industry: string | null;
  constraints: string[];
  desiredCapability: string;
  implementationContext: string;
  status: Status;
  publicationStatus: Status;
  createdAt: string;
  deadline: string | null;
  /** Связанные технологии/исполнители (известные). */
  matchedTechnologies: TechnologyMatch[];
  relatedPilot: Pilot | null;
}

/* ------------------------------------------------------------------ */
/* НИОКТР / исследования (ResearchRecord, DATA-CONTRACTS §4)           */
/* ------------------------------------------------------------------ */

/** Запись реестра НИОКТР (реальные данные; фикстур нет). */
export interface ResearchRecord {
  id: string;
  registrationNumber: string;
  title: string;
  annotation: string;
  organizationName: string;
  customerName: string;
  researchTypes: string[];
  keywords: string[];
  /** Может отсутствовать — частичные данные показываются как есть. */
  stateProgram: string | null;
  /** Дата из исходных данных (только если sourced). */
  createdDate: string;
  isAiArea: boolean;
  isAiUsage: boolean;
  /** Регион, если известен в исходных данных (в sample отсутствует). */
  region: string | null;
  publicationStatus: "published";
  provenance: ResearchProvenance;
}

/* ------------------------------------------------------------------ */
/* Организации                                                        */
/* ------------------------------------------------------------------ */

/** Организация из производного справочника (executor/customer карточек НИОКТР). */
export interface OrganizationSummary extends Partial<FixtureMarker> {
  id: string;
  name: string;
  type: "executor" | "customer" | "unknown";
  region: string | null;
  researchCount: number;
  source: string;
}

/* ------------------------------------------------------------------ */
/* Пилоты                                                             */
/* ------------------------------------------------------------------ */

/** Пилотный проект (заказчик × исполнитель × технология). */
export interface Pilot extends Partial<FixtureMarker> {
  id: string;
  title: string;
  description: string;
  status: Status;
  industry: string | null;
  customerName: string | null;
  partnerName: string | null;
  technologyId: string | null;
  technologyTitle: string | null;
  startedAt: string | null;
  plannedEndAt: string | null;
  expectedOutcome: string | null;
}

/* ------------------------------------------------------------------ */
/* Операционные задачи (OperationalTask, DATA-CONTRACTS §4)            */
/* ------------------------------------------------------------------ */

export type OperationalTaskObjectType =
  | "technology"
  | "request"
  | "organization"
  | "research"
  | "pilot";

export type OperationalTaskType =
  | "verify"
  | "review"
  | "clarification"
  | "decision"
  | "publication"
  | "recheck"
  | "onboarding";

export type Priority = "low" | "medium" | "high" | "urgent";

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочно",
};

/** Задача операционной очереди Центра. */
export interface OperationalTask extends Partial<FixtureMarker> {
  id: string;
  objectType: OperationalTaskObjectType;
  objectId: string;
  objectTitle: string;
  taskType: OperationalTaskType;
  priority: Priority;
  status: Status;
  assignee: string;
  dueDate: string | null;
  missingEvidenceSummary: string | null;
  lastEvent: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Уведомления, комментарии, решения                                  */
/* ------------------------------------------------------------------ */

export type NotificationUrgency = "low" | "medium" | "high";

/** Событие уведомления (STATES.md §5). */
export interface NotificationEvent extends Partial<FixtureMarker> {
  id: string;
  objectType: OperationalTaskObjectType | "document" | "decision" | "system";
  objectId: string;
  event: string;
  urgency: NotificationUrgency;
  requiredAction: string | null;
  deadline: string | null;
  read: boolean;
  destination: "inbox" | "email";
  createdAt: string;
}

/** Комментарий к объекту (технология/запрос/документ/чекпоинт/решение). */
export interface Comment extends Partial<FixtureMarker> {
  id: string;
  objectType: OperationalTaskObjectType | "document" | "checkpoint" | "decision";
  objectId: string;
  author: string;
  text: string;
  createdAt: string;
  visibilityScope: VisibilityScope;
}

export interface CommentInput {
  objectType: Comment["objectType"];
  objectId: string;
  text: string;
  scope: VisibilityScope;
}

/** Решение (STATES.md §4). */
export interface Decision extends Partial<FixtureMarker> {
  id: string;
  objectType: OperationalTaskObjectType | "document";
  objectId: string;
  decision: Extract<Status, "approved" | "rejected" | "clarification">;
  actor: string;
  dateTime: string;
  reason: string | null;
  linkedEvidence: string[];
  nextAction: string | null;
  visibilityScope: VisibilityScope;
}

export interface DecisionInput {
  objectType: Decision["objectType"];
  objectId: string;
  decision: Decision["decision"];
  reason: string;
  scope: VisibilityScope;
}

/* ------------------------------------------------------------------ */
/* Действия пользователя (черновики, подача)                          */
/* ------------------------------------------------------------------ */

export type DraftObjectType = "technology" | "request" | "research";

export interface DraftInput {
  objectType: DraftObjectType;
  id: string;
  /** Частичные данные черновика (форма не обязана быть полной). */
  payload: Record<string, unknown>;
}

export interface SaveResult {
  ok: true;
  id: string;
  savedAt: string;
  status: "draft";
}

export interface SubmissionInput {
  objectType: DraftObjectType;
  id: string;
  scope: VisibilityScope;
}

export interface SubmissionResult {
  ok: true;
  id: string;
  status: "under_review";
  submittedAt: string;
}

/* ------------------------------------------------------------------ */
/* Сводки (HomeSummary, WorkspaceSnapshot)                             */
/* ------------------------------------------------------------------ */

/** Сводка главной страницы (реальные счётчики или честные пустые значения). */
export interface HomeSummary {
  researchCount: number;
  technologiesCount: number;
  requestsCount: number;
  organizationsCount: number;
  recentResearch: ResearchRecord[];
  dataSource: string;
  lastUpdatedAt: string | null;
  /** Честные сообщения для разделов без реальных записей (DATA-CONTRACTS §2). */
  emptyStateMessages: {
    technologies: string;
    requests: string;
    pilots: string;
  };
}

/** Секция рабочего пространства роли. */
export interface WorkspaceSection<T> {
  title: string;
  emptyMessage: string;
  items: T[];
  total: number;
}

/** Снимок рабочего пространства роли (авторизованные кабинеты). */
export interface WorkspaceSnapshot {
  role: Role;
  updatedAt: string;
  urgentActions: OperationalTask[];
  notifications: NotificationEvent[];
  technologies: WorkspaceSection<TechnologySummary>;
  requests: WorkspaceSection<CustomerRequestSummary>;
  pilots: WorkspaceSection<Pilot>;
  queue: WorkspaceSection<OperationalTask>;
}
