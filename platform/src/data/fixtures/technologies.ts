/**
 * T-004. Контролируемые UI-фикстуры технологий (досье и карточки).
 *
 * НАЗНАЧЕНИЕ: проверка сценариев статусов в авторизованных кабинетах
 * (STATES.md §1): draft / under_review / clarification / approved / rejected /
 * published, путь УГТ N→N+1, требования по evidence.
 *
 * ПРАВИЛА (spec ASSUMPTION 3, DATA-CONTRACTS §5):
 * - каждая запись помечена isFixture: true + label «Тестовый пример для
 *   проверки интерфейса»;
 * - фикстуры доступны ТОЛЬКО в непубличных scope (participant/operations)
 *   и НИКОГДА не возвращаются публичными методами адаптера;
 * - это тестовые примеры интерфейса, а не выдуманные реальные компании/
 *   технологии — названия явно тестовые.
 */

import {
  FIXTURE_LABEL,
  fixtureMarker,
  type Status,
  type TechnologyDossier,
  type TechnologySummary,
} from "../../lib/types.ts";

const fixture = fixtureMarker();

/* ------------------------------------------------------------------ */
/* Карточки (для списков кабинета партнёра)                           */
/* ------------------------------------------------------------------ */

export const technologySummaryFixtures: TechnologySummary[] = [
  {
    id: "fixture-tech-draft-01",
    title: "Тестовая технология: модульная система мониторинга",
    shortDescription:
      "Тестовый пример для проверки интерфейса в статусе «Черновик»: карточка создана, но не подана на проверку.",
    industry: "Промышленность",
    organizationName: "Тестовая организация",
    ugtLevel: 1,
    ugtBand: "low",
    verificationStatus: "draft",
    publicationStatus: "draft",
    lastUpdatedAt: "2026-08-01T10:00:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-tech-review-02",
    title: "Тестовая технология: композитный материал для машиностроения",
    shortDescription:
      "Тестовый пример для проверки интерфейса в статусе «На проверке»: заявка подана, ожидает решения Центра.",
    industry: "Машиностроение",
    organizationName: "Тестовая организация",
    ugtLevel: 3,
    ugtBand: "low",
    verificationStatus: "under_review",
    publicationStatus: "draft",
    lastUpdatedAt: "2026-08-03T12:30:00.000Z",
    availableEvidenceCount: 3,
    ...fixture,
  },
  {
    id: "fixture-tech-clarification-03",
    title: "Тестовая технология: датчик контроля вибрации",
    shortDescription:
      "Тестовый пример для проверки интерфейса в статусе «Нужны уточнения»: рецензент запросил дополнительные свидетельства.",
    industry: "Приборостроение",
    organizationName: "Тестовая организация",
    ugtLevel: 4,
    ugtBand: "medium",
    verificationStatus: "clarification",
    publicationStatus: "draft",
    lastUpdatedAt: "2026-08-04T09:15:00.000Z",
    availableEvidenceCount: 2,
    ...fixture,
  },
  {
    id: "fixture-tech-approved-04",
    title: "Тестовая технология: цифровой двойник производственной линии",
    shortDescription:
      "Тестовый пример для проверки интерфейса в статусе «Одобрено»: верификация пройдена, публикация готовится.",
    industry: "Цифровые технологии",
    organizationName: "Тестовая организация",
    ugtLevel: 6,
    ugtBand: "medium",
    verificationStatus: "approved",
    publicationStatus: "approval",
    lastUpdatedAt: "2026-08-02T15:45:00.000Z",
    availableEvidenceCount: 5,
    ...fixture,
  },
  {
    id: "fixture-tech-rejected-05",
    title: "Тестовая технология: лабораторный реактор нового типа",
    shortDescription:
      "Тестовый пример для проверки интерфейса в статусе «Отклонено»: показана причина отказа и путь к доработке.",
    industry: "Химическая промышленность",
    organizationName: "Тестовая организация",
    ugtLevel: 2,
    ugtBand: "low",
    verificationStatus: "rejected",
    publicationStatus: "draft",
    lastUpdatedAt: "2026-07-28T11:00:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-tech-published-06",
    title: "Тестовая технология: энергоэффективная система освещения",
    shortDescription:
      "Тестовый пример для проверки интерфейса в статусе «Опубликовано»: запись видна в кабинете партнёра (в публичный реестр фикстуры не попадают).",
    industry: "Энергетика",
    organizationName: "Тестовая организация",
    ugtLevel: 7,
    ugtBand: "high",
    verificationStatus: "published",
    publicationStatus: "published",
    lastUpdatedAt: "2026-08-05T08:00:00.000Z",
    availableEvidenceCount: 8,
    ...fixture,
  },
];

/* ------------------------------------------------------------------ */
/* Досье (для страницы технологии в кабинете/операционном центре)      */
/* ------------------------------------------------------------------ */

const dossierBase = (
  summary: TechnologySummary,
): Omit<TechnologyDossier, "id" | "title" | "shortDescription"> => ({
  problem: "Описание проблемы — тестовый пример для проверки интерфейса.",
  solution:
    "Описание решения — тестовый пример для проверки интерфейса. Содержимое не является реальной технологией.",
  applicationAreas: ["Промышленность", "Мониторинг"],
  industries: summary.industry ? [summary.industry] : [],
  organization: {
    name: summary.organizationName,
    region: null,
    role: "executor",
  },
  teamAndPartners: null,
  ugt: {
    currentLevel: summary.ugtLevel,
    band: summary.ugtBand,
    verificationDate: null,
    history: [
      {
        level: summary.ugtLevel,
        date: summary.lastUpdatedAt,
        actor: "Тестовая организация",
        decision: summary.verificationStatus,
      },
    ],
  },
  readiness: [
    {
      dimension: "scientific",
      score: 2,
      summary: "Тестовое значение по научной оси.",
    },
    {
      dimension: "technical",
      score: 2,
      summary: "Тестовое значение по технической оси.",
    },
    {
      dimension: "production",
      score: 1,
      summary: "Тестовое значение по производственной оси.",
    },
    {
      dimension: "organizational",
      score: 1,
      summary: "Тестовое значение по организационной оси.",
    },
  ],
  checkpoints: [
    {
      id: `fixture-cp-${summary.id}`,
      level: summary.ugtLevel + 1,
      title: "Следующая контрольная точка (тестовый пример)",
      status: summary.verificationStatus,
      dueDate: null,
      evidenceCount: 0,
    },
  ],
  evidence: summary.availableEvidenceCount
    ? Array.from({ length: Math.min(summary.availableEvidenceCount, 2) }, (_, i) => ({
        id: `fixture-ev-${summary.id}-${i}`,
        title: `Тестовое свидетельство ${i + 1}`,
        kind: "document",
        status: "approved" as Status,
        uploadedAt: summary.lastUpdatedAt,
      }))
    : [],
  documents: [],
  customerRequestsAndMatches: [],
  pilots: [],
  decisionHistory: [],
  visibility: {
    scope: "participant",
    publicationStatus: summary.publicationStatus,
    publishedAt: null,
    updatedAt: summary.lastUpdatedAt,
  },
});

export const technologyDossierFixtures: TechnologyDossier[] =
  technologySummaryFixtures.map((summary) => ({
    id: summary.id,
    title: summary.title,
    shortDescription: summary.shortDescription,
    ...dossierBase(summary),
    ...fixture,
  }));

/** Индекс досье по id (для быстрого поиска в адаптере). */
export const technologyDossiersById: ReadonlyMap<string, TechnologyDossier> =
  new Map(technologyDossierFixtures.map((d) => [d.id, d]));

export const FIXTURE_LABEL_TECHNOLOGIES = FIXTURE_LABEL;
