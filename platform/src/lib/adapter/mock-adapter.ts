/**
 * T-004. Mock-адаптер данных на РЕАЛЬНЫХ карточках НИОКТР.
 *
 * Реализация PlatformDataAdapter для разработки интерфейсов (DATA_ADAPTER=mock).
 *
 * ПОЛИТИКА РЕАЛЬНОСТИ (DATA-CONTRACTS §2, §5):
 * - публичные методы (listResearch, listOrganizations, getResearch,
 *   listTechnologies, listCustomerRequests, getHomeSummary, getUgtMethodology,
 *   getTechnology/getCustomerRequest в scope "public") работают ТОЛЬКО с
 *   реальными данными из dataset (400 карточек НИОКТР) и честными пустыми
 *   состояниями — контролируемые UI-фикстуры в них НЕ ПОПАДАЮТ;
 * - фикстуры (isFixture: true) доступны только в авторизованных областях:
 *   getWorkspace(role), getOperationsQueue(query) и
 *   getTechnology/getCustomerRequest при scope ≠ "public".
 *
 * Задержка (для skeleton-состояний) и ошибки (для error-состояний)
 * настраиваются методами simulate* — они не входят в интерфейс адаптера.
 */

import {
  type Comment,
  type CommentInput,
  type NioktrOrganization,
  type CustomerRequest,
  type CustomerRequestSummary,
  type Decision,
  type DecisionInput,
  type DraftInput,
  type HomeSummary,
  type NioktrCard,
  type NioktrDataset,
  type OperationalTask,
  type OrganizationSummary,
  type Pilot,
  type ResearchRecord,
  type Role,
  type SaveResult,
  type SubmissionInput,
  type SubmissionResult,
  type TechnologyDossier,
  type TechnologySummary,
  type UgtDimension,
  type UgtLevelInfo,
  type UgtMethodology,
  type WorkspaceSection,
  type WorkspaceSnapshot,
} from "../types.ts";
import {
  type ListQuery,
  type Page,
  type PlatformDataAdapter,
  type QueueQuery,
  type VisibilityScope,
} from "./types.ts";
import { AdapterError } from "./errors.ts";
import {
  fixtureCatalog,
  type FixtureCatalog,
} from "../../data/fixtures/index.ts";

export type AdapterMethod = keyof PlatformDataAdapter;

export interface MockAdapterOptions {
  /** Реальные данные (карточки НИОКТР). Обязателен — без данных нет адаптера. */
  dataset: NioktrDataset;
  /** Задержка ответа в мс для skeleton-состояний (по умолчанию 250). */
  delayMs?: number;
  /** Переопределение каталога фикстур (для тестов). */
  fixtures?: Partial<FixtureCatalog>;
}

const DEFAULT_DELAY_MS = 250;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Уровни УГТ 1–9 по ГОСТ Р 58048-2017 (названия из карты уровней платформы). */
const UGT_LEVELS: UgtLevelInfo[] = [
  { number: 1, code: "УГТ 1", name: "Базовые принципы", short: "Основные принципы технологии изучены и опубликованы", band: "low" },
  { number: 2, code: "УГТ 2", name: "Технологическая концепция", short: "Концепция технологии и/или её применения сформулированы", band: "low" },
  { number: 3, code: "УГТ 3", name: "Критические функции", short: "Критические функции и/или характеристики подтверждены", band: "low" },
  { number: 4, code: "УГТ 4", name: "Лабораторная проверка", short: "Компонент и/или макет испытаны в лабораторном окружении", band: "medium" },
  { number: 5, code: "УГТ 5", name: "Верификация в реальных условиях", short: "Компонент и/или макет испытаны в окружении, близком к реальному", band: "medium" },
  { number: 6, code: "УГТ 6", name: "Системный прототип", short: "Модель системы/подсистемы продемонстрированы в релевантном окружении", band: "medium" },
  { number: 7, code: "УГТ 7", name: "Полевые испытания", short: "Прототип системы продемонстрирован в условиях эксплуатации", band: "high" },
  { number: 8, code: "УГТ 8", name: "Завершение и квалификация", short: "Реальная система завершена и квалифицирована", band: "high" },
  { number: 9, code: "УГТ 9", name: "Успешная эксплуатация", short: "Реальная система подтверждена путём успешной эксплуатации", band: "high" },
];

/** Измерения готовности (оси оценки УГТ). */
const UGT_DIMENSIONS: UgtDimension[] = [
  { id: "scientific", label: "Научная", description: "Научная обоснованность, публикации и патенты" },
  { id: "technical", label: "Техническая", description: "Техническая реализуемость, макеты и прототипы" },
  { id: "production", label: "Производственная", description: "Готовность к производству и масштабированию" },
  { id: "organizational", label: "Организационная", description: "Организационные условия внедрения и команда" },
];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const toArr = (v: string | string[] | undefined): string[] => {
  if (v === undefined) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((s) => String(s).trim()).filter(Boolean);
};

const parseBool = (v: string | string[] | undefined): boolean | undefined => {
  const raw = toArr(v)[0];
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
};

function paginate<T>(items: T[], query: ListQuery, defaultPageSize = DEFAULT_PAGE_SIZE): Page<T> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.max(1, Math.min(Math.floor(query.pageSize ?? defaultPageSize), MAX_PAGE_SIZE));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

const hashCode = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
};

const slugify = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `org-${Math.abs(hashCode(name))}`;
};

export class MockPlatformDataAdapter implements PlatformDataAdapter {
  private readonly dataset: NioktrDataset;
  private readonly fixtures: FixtureCatalog;
  private delayMs: number;
  private readonly failAlways = new Set<AdapterMethod>();
  private readonly failOnce = new Set<AdapterMethod>();
  private commentSeq = 0;
  private decisionSeq = 0;

  constructor(options: MockAdapterOptions) {
    this.dataset = options.dataset;
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.fixtures = { ...fixtureCatalog, ...options.fixtures };
  }

  /* ---------------------------------------------------------------- */
  /* Управление симуляцией (НЕ входит в интерфейс PlatformDataAdapter) */
  /* ---------------------------------------------------------------- */

  /** Установить задержку ответа (мс) для проверки skeleton-состояний. */
  setDelayMs(ms: number): void {
    this.delayMs = Math.max(0, ms);
  }

  /** Текущая задержка. */
  getDelayMs(): number {
    return this.delayMs;
  }

  /**
   * Симулировать сбой метода: once=true — следующий вызов бросит ошибку,
   * once=false — до clearFailures().
   */
  simulateFailure(method: AdapterMethod, options: { once?: boolean } = {}): void {
    if (options.once ?? true) {
      this.failOnce.add(method);
    } else {
      this.failAlways.add(method);
    }
  }

  /** Сбросить все симулируемые сбои. */
  clearFailures(): void {
    this.failAlways.clear();
    this.failOnce.clear();
  }

  private async wait(method: AdapterMethod): Promise<void> {
    if (this.failOnce.delete(method)) {
      throw new AdapterError(`Симулированный сбой метода ${method} (mock-адаптер)`, { method });
    }
    if (this.failAlways.has(method)) {
      throw new AdapterError(`Симулированный постоянный сбой метода ${method} (mock-адаптер)`, { method });
    }
    if (this.delayMs > 0) {
      await sleep(this.delayMs);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Сырые данные                                                      */
  /* ---------------------------------------------------------------- */

  private get provenanceSource(): string {
    return this.dataset.provenance?.source ?? "МИНОБРНАУКИ России";
  }

  private get importedAt(): string | null {
    return this.dataset.provenance?.importedAt ?? null;
  }

  private orgName(org: NioktrOrganization): string {
    return org.short_name?.trim() || org.name?.trim() || "—";
  }

  private toResearchRecord(card: NioktrCard): ResearchRecord {
    return {
      id: card.registration_number,
      registrationNumber: card.registration_number,
      title: card.name,
      annotation: card.annotation,
      organizationName: this.orgName(card.executor),
      customerName: this.orgName(card.customer),
      researchTypes: card.nioktr_types,
      keywords: card.keywords,
      stateProgram: card.state_program ? card.state_program : null,
      createdDate: card.created_date,
      isAiArea: card.is_ai_area,
      isAiUsage: card.is_ai_usage,
      region: card.executor.region ?? card.customer.region ?? null,
      publicationStatus: "published",
      provenance: {
        source: this.provenanceSource,
        importedAt: this.importedAt,
        sourceUrl: null,
      },
    };
  }

  private allResearch(): ResearchRecord[] {
    return this.dataset.cards.map((card) => this.toResearchRecord(card));
  }

  /** Справочник организаций, производный от реальных карточек НИОКТР. */
  private buildOrganizations(): OrganizationSummary[] {
    const byKey = new Map<string, OrganizationSummary>();
    const add = (org: NioktrOrganization, type: "executor" | "customer"): void => {
      const name = org?.name?.trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.researchCount += 1;
        if (existing.type === "unknown") existing.type = type;
        return;
      }
      byKey.set(key, {
        id: slugify(org.short_name?.trim() || name),
        name: this.orgName(org),
        type,
        region: org.region ?? null,
        researchCount: 1,
        source: this.provenanceSource,
      });
    };
    for (const card of this.dataset.cards) {
      add(card.executor, "executor");
      add(card.customer, "customer");
    }
    return [...byKey.values()];
  }

  /* ---------------------------------------------------------------- */
  /* Публичные методы (реальные данные или честные empty; БЕЗ фикстур) */
  /* ---------------------------------------------------------------- */

  async getHomeSummary(): Promise<HomeSummary> {
    await this.wait("getHomeSummary");
    const research = this.allResearch();
    const recent = [...research]
      .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
      .slice(0, 6);
    return {
      researchCount: research.length,
      technologiesCount: 0,
      requestsCount: 0,
      organizationsCount: this.buildOrganizations().length,
      recentResearch: recent,
      dataSource: this.provenanceSource,
      lastUpdatedAt: this.importedAt,
      emptyStateMessages: {
        technologies: "Пока нет опубликованных технологий",
        requests: "Пока нет опубликованных запросов",
        pilots: "Пока нет опубликованных пилотов",
      },
    };
  }

  async listTechnologies(query: ListQuery): Promise<Page<TechnologySummary>> {
    await this.wait("listTechnologies");
    // В P0 реальных досье технологий нет — честное пустое состояние.
    // Контролируемые UI-фикстуры в публичный реестр НЕ попадают.
    return paginate<TechnologySummary>([], query);
  }

  async getTechnology(id: string, scope: VisibilityScope): Promise<TechnologyDossier | null> {
    await this.wait("getTechnology");
    if (scope === "public") {
      // Публичный реестр: только реальные записи; в P0 их нет.
      return null;
    }
    return this.fixtures.technologyDossiers.find((d) => d.id === id) ?? null;
  }

  async listCustomerRequests(query: ListQuery): Promise<Page<CustomerRequestSummary>> {
    await this.wait("listCustomerRequests");
    // В P0 реальных запросов заказчиков нет — честное пустое состояние.
    return paginate<CustomerRequestSummary>([], query);
  }

  async getCustomerRequest(id: string, scope: VisibilityScope): Promise<CustomerRequest | null> {
    await this.wait("getCustomerRequest");
    if (scope === "public") {
      return null;
    }
    return this.fixtures.customerRequestFull.find((r) => r.id === id) ?? null;
  }

  async listOrganizations(query: ListQuery): Promise<Page<OrganizationSummary>> {
    await this.wait("listOrganizations");
    const search = query.search?.trim().toLowerCase() ?? "";
    let items = this.buildOrganizations();
    if (search) {
      items = items.filter((o) => o.name.toLowerCase().includes(search));
    }
    const sort = query.sort ?? "name";
    items = [...items].sort((a, b) => {
      if (sort === "researchCount") return b.researchCount - a.researchCount;
      return a.name.localeCompare(b.name, "ru");
    });
    return paginate(items, query);
  }

  async listResearch(query: ListQuery): Promise<Page<ResearchRecord>> {
    await this.wait("listResearch");
    const search = query.search?.trim().toLowerCase() ?? "";
    const filters = query.filters ?? {};
    const aiArea = parseBool(filters.is_ai_area);
    const aiUsage = parseBool(filters.is_ai_usage);
    const types = toArr(filters.nioktr_types);
    const programs = toArr(filters.state_program);
    const years = toArr(filters.year);

    let items = this.allResearch().filter((r) => {
      if (search) {
        const haystack = [
          r.title,
          r.annotation,
          r.organizationName,
          r.customerName,
          r.registrationNumber,
          ...r.keywords,
          ...r.researchTypes,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (aiArea !== undefined && r.isAiArea !== aiArea) return false;
      if (aiUsage !== undefined && r.isAiUsage !== aiUsage) return false;
      if (
        types.length > 0 &&
        !types.some((t) => r.researchTypes.some((rt) => rt.toLowerCase().includes(t.toLowerCase())))
      ) {
        return false;
      }
      if (
        programs.length > 0 &&
        !programs.some((p) => (r.stateProgram ?? "").toLowerCase().includes(p.toLowerCase()))
      ) {
        return false;
      }
      if (
        years.length > 0 &&
        !years.some((y) => r.createdDate.startsWith(y))
      ) {
        return false;
      }
      return true;
    });

    const sort = query.sort ?? "created_date_desc";
    items = [...items].sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.title.localeCompare(b.title, "ru");
        case "name_desc":
          return b.title.localeCompare(a.title, "ru");
        case "created_date_asc":
          return a.createdDate.localeCompare(b.createdDate);
        default:
          return b.createdDate.localeCompare(a.createdDate);
      }
    });

    return paginate(items, query);
  }

  async getResearch(id: string, _scope: VisibilityScope): Promise<ResearchRecord | null> {
    await this.wait("getResearch");
    const card = this.dataset.cards.find((c) => c.registration_number === id);
    return card ? this.toResearchRecord(card) : null;
  }

  async getUgtMethodology(): Promise<UgtMethodology> {
    await this.wait("getUgtMethodology");
    return {
      levels: UGT_LEVELS,
      bands: [
        { band: "low", label: "Низкий", range: [1, 3] },
        { band: "medium", label: "Средний", range: [4, 6] },
        { band: "high", label: "Высокий", range: [7, 9] },
      ],
      dimensions: UGT_DIMENSIONS,
      transition: {
        description:
          "Переход N → N+1 подтверждается комплектом свидетельств и решением Центра; за одну проверку уровень повышается максимум на 1.",
        maxGainPerReview: 1,
        evidenceRequired: true,
        reportPathYears: 3,
      },
      source: "ГОСТ Р 58048-2017",
    };
  }

  /* ---------------------------------------------------------------- */
  /* Авторизованные методы (здесь допустимы контролируемые фикстуры)   */
  /* ---------------------------------------------------------------- */

  async getWorkspace(role: Role): Promise<WorkspaceSnapshot> {
    await this.wait("getWorkspace");
    const updatedAt = new Date().toISOString();

    const empty = <T,>(title: string, emptyMessage: string): WorkspaceSection<T> => ({
      title,
      emptyMessage,
      items: [],
      total: 0,
    });

    const technologies: WorkspaceSection<TechnologySummary> =
      role === "partner" || role === "manufacturer"
        ? {
            title: "Технологии",
            emptyMessage: "У вашей организации пока нет технологий",
            items: this.fixtures.technologies,
            total: this.fixtures.technologies.length,
          }
        : empty<TechnologySummary>("Технологии", "У вашей организации пока нет технологий");

    const requests: WorkspaceSection<CustomerRequestSummary> =
      role === "customer"
        ? {
            title: "Запросы",
            emptyMessage: "У вашей организации пока нет запросов",
            items: this.fixtures.customerRequests,
            total: this.fixtures.customerRequests.length,
          }
        : empty<CustomerRequestSummary>("Запросы", "У вашей организации пока нет запросов");

    const pilots: WorkspaceSection<Pilot> =
      role === "customer" || role === "partner"
        ? {
            title: "Пилоты",
            emptyMessage: "Пока нет пилотов с вашим участием",
            items: this.fixtures.pilots,
            total: this.fixtures.pilots.length,
          }
        : empty<Pilot>("Пилоты", "Пока нет пилотов с вашим участием");

    const queue: WorkspaceSection<OperationalTask> =
      role === "center_employee" || role === "center_manager" || role === "center_admin"
        ? {
            title: "Очередь задач",
            emptyMessage: "Очередь пуста",
            items: this.fixtures.operationalTasks,
            total: this.fixtures.operationalTasks.length,
          }
        : empty<OperationalTask>("Очередь задач", "Очередь пуста");

    const urgentActions = this.fixtures.operationalTasks.filter(
      (t) => t.status === "action_required" || t.status === "blocked",
    );

    return {
      role,
      updatedAt,
      urgentActions,
      notifications: this.fixtures.notifications,
      technologies,
      requests,
      pilots,
      queue,
    };
  }

  async getOperationsQueue(query: QueueQuery): Promise<Page<OperationalTask>> {
    await this.wait("getOperationsQueue");
    const search = query.search?.trim().toLowerCase() ?? "";
    const status = query.status;
    const priority = query.priority;
    let items = this.fixtures.operationalTasks.filter((t) => {
      if (search) {
        const haystack = [t.objectTitle, t.objectId, t.lastEvent, t.nextAction].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      return true;
    });
    const sort = query.sort ?? "priority";
    items = [...items].sort((a, b) => {
      if (sort === "dueDate") {
        return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      }
      const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    });
    return paginate(items, query);
  }

  /* ---------------------------------------------------------------- */
  /* Действия пользователя                                             */
  /* ---------------------------------------------------------------- */

  async saveDraft(input: DraftInput): Promise<SaveResult> {
    await this.wait("saveDraft");
    return { ok: true, id: input.id, savedAt: new Date().toISOString(), status: "draft" };
  }

  async submitForReview(input: SubmissionInput): Promise<SubmissionResult> {
    await this.wait("submitForReview");
    return { ok: true, id: input.id, status: "under_review", submittedAt: new Date().toISOString() };
  }

  async addComment(input: CommentInput): Promise<Comment> {
    await this.wait("addComment");
    this.commentSeq += 1;
    return {
      id: `comment-${this.commentSeq}`,
      objectType: input.objectType,
      objectId: input.objectId,
      author: "Текущий пользователь (mock-сессия)",
      text: input.text,
      createdAt: new Date().toISOString(),
      visibilityScope: input.scope,
    };
  }

  async recordDecision(input: DecisionInput): Promise<Decision> {
    await this.wait("recordDecision");
    this.decisionSeq += 1;
    return {
      id: `decision-${this.decisionSeq}`,
      objectType: input.objectType,
      objectId: input.objectId,
      decision: input.decision,
      actor: "Текущий пользователь (mock-сессия)",
      dateTime: new Date().toISOString(),
      reason: input.reason,
      linkedEvidence: [],
      nextAction: null,
      visibilityScope: input.scope,
    };
  }
}
