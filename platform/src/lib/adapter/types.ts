/**
 * T-004. Контракт слоя данных: интерфейс PlatformDataAdapter и запросные типы.
 *
 * DATA-CONTRACTS §3. UI-компоненты зависят только от операций продукта,
 * а не от хранилищ/URL. Единственная точка интеграции с бэкендом — адаптер:
 * DATA_ADAPTER=mock|api, замена одной строки без правок компонентов.
 */

import type {
  Comment,
  CommentInput,
  CustomerRequest,
  CustomerRequestSummary,
  Decision,
  DecisionInput,
  DraftInput,
  HomeSummary,
  OperationalTask,
  OrganizationSummary,
  ResearchRecord,
  Role,
  SaveResult,
  Status,
  SubmissionInput,
  SubmissionResult,
  TechnologyDossier,
  TechnologySummary,
  UgtMethodology,
  WorkspaceSnapshot,
} from "../types.ts";

/* ------------------------------------------------------------------ */
/* Запросные типы                                                      */
/* ------------------------------------------------------------------ */

/** Универсальный запрос списка: поиск, фильтры, сортировка, пагинация. */
export interface ListQuery {
  search?: string;
  /**
   * Фильтры по именованным полям. Значения — строка или массив строк
   * (для мультивыбора). Семантика значений — на стороне адаптера.
   */
  filters?: Record<string, string | string[] | undefined>;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** Запрос операционной очереди: ListQuery + фильтр статуса/приоритета. */
export interface QueueQuery extends ListQuery {
  status?: Status;
  priority?: string;
}

/** Страница результатов списка. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/* ------------------------------------------------------------------ */
/* Видимость                                                           */
/* ------------------------------------------------------------------ */

/**
 * Контекст просмотра записи:
 * - `public` — публичный реестр (только реальные данные, фикстуры запрещены);
 * - `participant` — авторизованный участник (владелец/партнёр);
 * - `operations` — операционный центр (сотрудник/менеджер Центра).
 */
export type VisibilityScope = "public" | "participant" | "operations";

/* ------------------------------------------------------------------ */
/* Интерфейс адаптера                                                  */
/* ------------------------------------------------------------------ */

/**
 * Единственная точка доступа к данным платформы.
 * Каждый метод возвращает типизированный результат; отсутствие записи —
 * `null`, пустой список — пустая Page (честные empty-состояния).
 * Ошибки и задержки — на усмотрение реализации (mock умеет симулировать
 * и то, и другое для проверки loading/error-состояний UI).
 */
export interface PlatformDataAdapter {
  /** Сводка главной страницы: реальные счётчики и свежие записи НИОКТР. */
  getHomeSummary(): Promise<HomeSummary>;

  /** Публичный реестр технологий (в P0 реальных записей нет → пустая Page). */
  listTechnologies(query: ListQuery): Promise<Page<TechnologySummary>>;

  /** Досье технологии. В публичном scope фикстуры недоступны (null). */
  getTechnology(
    id: string,
    scope: VisibilityScope,
  ): Promise<TechnologyDossier | null>;

  /** Публичный реестр запросов заказчиков (в P0 — пустая Page). */
  listCustomerRequests(query: ListQuery): Promise<Page<CustomerRequestSummary>>;

  /** Полный запрос заказчика. Фикстуры — только в непубличных scope. */
  getCustomerRequest(
    id: string,
    scope: VisibilityScope,
  ): Promise<CustomerRequest | null>;

  /** Справочник организаций, производный от реальных карточек НИОКТР. */
  listOrganizations(query: ListQuery): Promise<Page<OrganizationSummary>>;

  /** Реестр НИОКТР: реальные 400 карточек с фильтрами и пагинацией. */
  listResearch(query: ListQuery): Promise<Page<ResearchRecord>>;

  /** Карточка НИОКТР по registration_number. */
  getResearch(
    id: string,
    scope: VisibilityScope,
  ): Promise<ResearchRecord | null>;

  /** Методология УГТ (ГОСТ Р 58048-2017). */
  getUgtMethodology(): Promise<UgtMethodology>;

  /** Снимок рабочего пространства роли (авторизованные кабинеты). */
  getWorkspace(role: Role): Promise<WorkspaceSnapshot>;

  /** Очередь операционных задач Центра. */
  getOperationsQueue(query: QueueQuery): Promise<Page<OperationalTask>>;

  /** Сохранить черновик. */
  saveDraft(input: DraftInput): Promise<SaveResult>;

  /** Подать на проверку. */
  submitForReview(input: SubmissionInput): Promise<SubmissionResult>;

  /** Добавить комментарий. */
  addComment(input: CommentInput): Promise<Comment>;

  /** Зафиксировать решение. */
  recordDecision(input: DecisionInput): Promise<Decision>;
}
