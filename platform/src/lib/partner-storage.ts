/**
 * T-009. Клиентское хранилище кабинета исполнителя (localStorage).
 *
 * Что хранится и почему:
 * - черновик досье технологии (`nfr-partner-tech-drafts` + активный id) —
 *   сценарий «создать досье → сохранить → вернуться → доказательства →
 *   подать» (тикет T-009, Design.md §13.3/§14);
 * - рабочее состояние досье (`nfr-partner-tech-evidence`) — принятые
 *   загрузки свидетельств и факт подачи на проверку (работает и для
 *   досье-фикстур, и для черновиков, созданных формой);
 * - заявки исполнителя (`nfr-partner-applications`) — «Подать заявку» на
 *   запрос заказчика создаёт локальную заявку со статусом «Черновик».
 *
 * ВАЖНО: это клиентский слой (window). Все функции безопасны при SSR:
 * при отсутствии window возвращают нейтральные значения, ничего не пишут.
 * Данные не фабрикуются: отсутствие хранилища = честное пустое состояние.
 */

import type {
  Status,
  TechnologyCheckpoint,
  TechnologyDossier,
  TechnologyEvidence,
} from "./types.ts";
import { bandOfLevel } from "./ugt.ts";

export const TECH_DRAFTS_KEY = "nfr-partner-tech-drafts";
export const TECH_ACTIVE_DRAFT_KEY = "nfr-partner-tech-active-draft";
export const TECH_EVIDENCE_KEY = "nfr-partner-tech-evidence";
export const APPLICATIONS_KEY = "nfr-partner-applications";

/* ------------------------------------------------------------------ */
/* Черновик досье технологии (поля формы)                             */
/* ------------------------------------------------------------------ */

/** Поля формы «Представить технологию» (T-009). */
export interface TechnologyDraftFields {
  title: string;
  shortDescription: string;
  industry: string;
  applicationAreas: string[];
  problem: string;
  solution: string;
  /** Заявленный уровень УГТ 1–9 (не подтверждён проверкой). */
  claimedLevel: number | null;
}

/** Черновик досье: поля формы + локальный жизненный цикл. */
export interface TechnologyDraftRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** true — форма завершена, досье-черновик создано. */
  created: boolean;
  /** Локальный статус досье (зеркало STATES.md для черновика). */
  status: "draft" | "under_review" | "clarification" | "rejected";
  fields: TechnologyDraftFields;
}

const safeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Прочитать все черновики досье ([] — нет/повреждено, не фабрикуем). */
export function listTechnologyDrafts(): TechnologyDraftRecord[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(TECH_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TechnologyDraftRecord =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.created === "boolean" &&
        Boolean(item.fields) &&
        typeof item.fields === "object",
    );
  } catch {
    return [];
  }
}

function writeTechnologyDrafts(list: TechnologyDraftRecord[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(TECH_DRAFTS_KEY, JSON.stringify(list));
  } catch {
    /* private mode и т.п. — черновик остаётся в состоянии формы */
  }
}

/** Сохранить черновик досье (перезаписывает по id). */
export function writeTechnologyDraft(record: TechnologyDraftRecord): void {
  const list = listTechnologyDrafts();
  const index = list.findIndex((item) => item.id === record.id);
  const next = { ...record, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    list[index] = next;
  } else {
    list.push(next);
  }
  writeTechnologyDrafts(list);
  setActiveTechnologyDraft(record.id);
}

/** Прочитать черновик досье по id (null — нет/повреждён). */
export function readTechnologyDraft(id: string): TechnologyDraftRecord | null {
  return listTechnologyDrafts().find((item) => item.id === id) ?? null;
}

/** Удалить черновик досье. */
export function removeTechnologyDraft(id: string): void {
  writeTechnologyDrafts(
    listTechnologyDrafts().filter((item) => item.id !== id),
  );
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (storage.getItem(TECH_ACTIVE_DRAFT_KEY) === id) {
      storage.removeItem(TECH_ACTIVE_DRAFT_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** id «активного» черновика (его восстанавливает форма). */
export function readActiveTechnologyDraftId(): string | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    return storage.getItem(TECH_ACTIVE_DRAFT_KEY);
  } catch {
    return null;
  }
}

function setActiveTechnologyDraft(id: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(TECH_ACTIVE_DRAFT_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Активный черновик формы (null, если нет/не создан). */
export function readActiveTechnologyDraft(): TechnologyDraftRecord | null {
  const id = readActiveTechnologyDraftId();
  if (!id) return null;
  return readTechnologyDraft(id);
}

/* ------------------------------------------------------------------ */
/* Рабочее состояние досье: свидетельства + подача                     */
/* ------------------------------------------------------------------ */

/** Свидетельства, загруженные пользователем, и факт подачи на проверку. */
export interface DossierWorkspaceRecord {
  evidence: TechnologyEvidence[];
  submission: { status: "under_review"; submittedAt: string } | null;
}

const EMPTY_RECORD: DossierWorkspaceRecord = { evidence: [], submission: null };

/** Прочитать рабочее состояние досье (пустое, если нет/повреждено). */
export function readDossierRecord(id: string): DossierWorkspaceRecord {
  const storage = safeStorage();
  if (!storage) return EMPTY_RECORD;
  try {
    const raw = storage.getItem(TECH_EVIDENCE_KEY);
    if (!raw) return EMPTY_RECORD;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const record = parsed[id] as Partial<DossierWorkspaceRecord> | undefined;
    if (!record || !Array.isArray(record.evidence)) return EMPTY_RECORD;
    return {
      evidence: record.evidence.filter(
        (item): item is TechnologyEvidence =>
          Boolean(item) && typeof item.id === "string" && typeof item.title === "string",
      ),
      submission:
        record.submission && record.submission.status === "under_review"
          ? {
              status: "under_review",
              submittedAt:
                typeof record.submission.submittedAt === "string"
                  ? record.submission.submittedAt
                  : new Date().toISOString(),
            }
          : null,
    };
  } catch {
    return EMPTY_RECORD;
  }
}

/** Сохранить рабочее состояние досье (перезаписывает по id). */
export function writeDossierRecord(id: string, record: DossierWorkspaceRecord): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(TECH_EVIDENCE_KEY);
    const all: Record<string, DossierWorkspaceRecord> = raw
      ? (JSON.parse(raw) as Record<string, DossierWorkspaceRecord>)
      : {};
    all[id] = record;
    storage.setItem(TECH_EVIDENCE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Черновик досье → полный TechnologyDossier (для evidence/path)       */
/* ------------------------------------------------------------------ */

/**
 * Собрать полное досье из черновика формы. Заявленный уровень остаётся
 * «заявленным» (не подтверждён проверкой — STATES.md §2); фиктивных
 * свидетельств/решений не создаётся.
 */
export function draftToDossier(draft: TechnologyDraftRecord): TechnologyDossier {
  const level = draft.fields.claimedLevel ?? 1;
  const band = bandOfLevel(level) ?? "low";
  const nextCheckpoint: TechnologyCheckpoint | null =
    level < 9
      ? {
          id: `cp-${draft.id}-next`,
          level: level + 1,
          title: "Следующая контрольная точка",
          status: draft.status,
          dueDate: null,
          evidenceCount: 0,
        }
      : null;
  return {
    id: draft.id,
    title:
      draft.fields.title.trim() !== ""
        ? draft.fields.title
        : "Новое досье технологии (черновик)",
    shortDescription:
      draft.fields.shortDescription.trim() !== ""
        ? draft.fields.shortDescription
        : "Черновик: описание ещё не заполнено.",
    problem:
      draft.fields.problem.trim() !== ""
        ? draft.fields.problem
        : "Черновик: описание проблемы ещё не заполнено.",
    solution:
      draft.fields.solution.trim() !== ""
        ? draft.fields.solution
        : "Черновик: описание решения ещё не заполнено.",
    applicationAreas: draft.fields.applicationAreas,
    industries: draft.fields.industry ? [draft.fields.industry] : [],
    organization: {
      name: "Ваша организация",
      region: null,
      role: "executor",
    },
    teamAndPartners: null,
    ugt: {
      currentLevel: level,
      band,
      verificationDate: null,
      history: [],
    },
    readiness: [],
    checkpoints: nextCheckpoint ? [nextCheckpoint] : [],
    evidence: [],
    documents: [],
    customerRequestsAndMatches: [],
    pilots: [],
    decisionHistory: [],
    visibility: {
      scope: "participant",
      publicationStatus: draft.status,
      publishedAt: null,
      updatedAt: draft.updatedAt,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Заявки исполнителя (подача на запросы/пилоты)                       */
/* ------------------------------------------------------------------ */

/** Заявка исполнителя на запрос заказчика или пилот. */
export interface PartnerApplicationRecord {
  id: string;
  targetType: "request" | "pilot";
  targetId: string;
  targetTitle: string;
  customerOrganization: string | null;
  status: Status;
  /** Пояснение (для clarification/rejected — что просит Центр). */
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** Все заявки ([] — нет/повреждено). */
export function listPartnerApplications(): PartnerApplicationRecord[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(APPLICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PartnerApplicationRecord =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.targetTitle === "string" &&
        typeof item.status === "string",
    );
  } catch {
    return [];
  }
}

function writePartnerApplications(list: PartnerApplicationRecord[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(APPLICATIONS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Создать заявку-черновик (кнопка «Подать заявку» на странице запросов). */
export function createPartnerApplication(input: {
  targetType: "request" | "pilot";
  targetId: string;
  targetTitle: string;
  customerOrganization: string | null;
}): PartnerApplicationRecord {
  const now = new Date().toISOString();
  const record: PartnerApplicationRecord = {
    id: `app-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    targetType: input.targetType,
    targetId: input.targetId,
    targetTitle: input.targetTitle,
    customerOrganization: input.customerOrganization,
    status: "draft",
    note: "",
    createdAt: now,
    updatedAt: now,
  };
  writePartnerApplications([...listPartnerApplications(), record]);
  return record;
}

/** Обновить статус заявки (локальная симуляция решения; бэкенд — на интеграции). */
export function updatePartnerApplicationStatus(
  id: string,
  status: Status,
  note = "",
): PartnerApplicationRecord | null {
  const list = listPartnerApplications();
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next: PartnerApplicationRecord = {
    ...list[index],
    status,
    note: note || list[index].note,
    updatedAt: new Date().toISOString(),
  };
  list[index] = next;
  writePartnerApplications(list);
  return next;
}
