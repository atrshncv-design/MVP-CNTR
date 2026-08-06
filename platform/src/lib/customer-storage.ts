/**
 * T-008. Клиентское хранилище кабинета заказчика (localStorage).
 *
 * Что хранится и почему:
 * - черновик запроса (`nfr-customer-request-draft`) — сценарий
 *   «создать → сохранить → вернуться → подать» (тикет T-008);
 * - шорт-листы (`nfr-shortlists`) — структура готова к нескольким спискам,
 *   в P0 используется один список «Мой шорт-лист»;
 * - выбор для сравнения (`nfr-compare-selection`) — id технологий.
 *
 * ВАЖНО: это клиентский слой (window). Все функции безопасны при SSR:
 * при отсутствии window возвращают нейтральные значения, ничего не пишут.
 * Данные не фабрикуются: отсутствие хранилища = пустое/честное состояние.
 */

export const REQUEST_DRAFT_STORAGE_KEY = "nfr-customer-request-draft";
export const SHORTLISTS_STORAGE_KEY = "nfr-shortlists";
export const COMPARE_STORAGE_KEY = "nfr-compare-selection";

/** Имя списка по умолчанию (P0 — один шорт-лист, структура под несколько). */
export const DEFAULT_SHORTLIST_ID = "main";
export const DEFAULT_SHORTLIST_NAME = "Мой шорт-лист";

/* ------------------------------------------------------------------ */
/* Черновик запроса                                                    */
/* ------------------------------------------------------------------ */

/** Поля формы запроса (T-008: проблема, ограничения, отрасль, контекст, результат). */
export interface RequestDraftFields {
  problemStatement: string;
  constraints: string[];
  industry: string;
  implementationContext: string;
  desiredCapability: string;
}

export interface RequestDraft {
  updatedAt: string;
  fields: RequestDraftFields;
}

const safeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Прочитать черновик запроса (null, если нет/повреждён — не фабрикуем). */
export function readRequestDraft(): RequestDraft | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(REQUEST_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RequestDraft>;
    if (
      typeof parsed.updatedAt !== "string" ||
      !parsed.fields ||
      typeof parsed.fields !== "object"
    ) {
      return null;
    }
    return parsed as RequestDraft;
  } catch {
    return null;
  }
}

/** Сохранить черновик (перезаписывает). */
export function writeRequestDraft(fields: RequestDraftFields, updatedAt = new Date().toISOString()): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(
      REQUEST_DRAFT_STORAGE_KEY,
      JSON.stringify({ updatedAt, fields } satisfies RequestDraft),
    );
  } catch {
    // Хранилище недоступно (private mode и т.п.) — молча пропускаем:
    // черновик остаётся в состоянии формы до навигации в рамках сессии.
  }
}

/** Удалить черновик (после успешной подачи или «начать заново»). */
export function clearRequestDraft(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(REQUEST_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Шорт-листы                                                          */
/* ------------------------------------------------------------------ */

export interface ShortlistList {
  id: string;
  name: string;
  technologyIds: string[];
}

export interface ShortlistStore {
  lists: ShortlistList[];
  updatedAt: string;
}

const EMPTY_STORE: ShortlistStore = { lists: [], updatedAt: "" };

/** Прочитать шорт-листы (пустой store, если нет/повреждён). */
export function readShortlists(): ShortlistStore {
  const storage = safeStorage();
  if (!storage) return EMPTY_STORE;
  try {
    const raw = storage.getItem(SHORTLISTS_STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<ShortlistStore>;
    if (!Array.isArray(parsed.lists)) return EMPTY_STORE;
    const lists = parsed.lists
      .filter(
        (l): l is ShortlistList =>
          Boolean(l) &&
          typeof l.id === "string" &&
          typeof l.name === "string" &&
          Array.isArray(l.technologyIds),
      )
      .map((l) => ({ ...l, technologyIds: l.technologyIds.filter((id) => typeof id === "string") }));
    return { lists, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "" };
  } catch {
    return EMPTY_STORE;
  }
}

function writeShortlists(store: ShortlistStore): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(SHORTLISTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

/** Гарантировать существование списка по умолчанию. */
function ensureDefaultList(store: ShortlistStore): ShortlistStore {
  if (store.lists.some((l) => l.id === DEFAULT_SHORTLIST_ID)) return store;
  return {
    lists: [
      ...store.lists,
      { id: DEFAULT_SHORTLIST_ID, name: DEFAULT_SHORTLIST_NAME, technologyIds: [] },
    ],
    updatedAt: store.updatedAt,
  };
}

/** id технологий в списке по умолчанию. */
export function defaultShortlistIds(): string[] {
  const store = ensureDefaultList(readShortlists());
  const list = store.lists.find((l) => l.id === DEFAULT_SHORTLIST_ID);
  return list ? list.technologyIds : [];
}

/** Есть ли технология в шорт-листе по умолчанию. */
export function isInShortlist(technologyId: string): boolean {
  return defaultShortlistIds().includes(technologyId);
}

/** Добавить технологию в шорт-лист по умолчанию. */
export function addToShortlist(technologyId: string): void {
  const store = ensureDefaultList(readShortlists());
  const lists = store.lists.map((l) =>
    l.id === DEFAULT_SHORTLIST_ID && !l.technologyIds.includes(technologyId)
      ? { ...l, technologyIds: [...l.technologyIds, technologyId] }
      : l,
  );
  writeShortlists({ lists, updatedAt: new Date().toISOString() });
}

/** Убрать технологию из шорт-листа по умолчанию. */
export function removeFromShortlist(technologyId: string): void {
  const store = readShortlists();
  const lists = store.lists.map((l) =>
    l.id === DEFAULT_SHORTLIST_ID
      ? { ...l, technologyIds: l.technologyIds.filter((id) => id !== technologyId) }
      : l,
  );
  writeShortlists({ lists, updatedAt: new Date().toISOString() });
}

/** Очистить шорт-лист по умолчанию. */
export function clearDefaultShortlist(): void {
  const store = readShortlists();
  const lists = store.lists.map((l) =>
    l.id === DEFAULT_SHORTLIST_ID ? { ...l, technologyIds: [] } : l,
  );
  writeShortlists({ lists, updatedAt: new Date().toISOString() });
}

/* ------------------------------------------------------------------ */
/* Выбор для сравнения                                                 */
/* ------------------------------------------------------------------ */

/** Прочитать выбранные для сравнения id технологий. */
export function readCompareSelection(): string[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Сохранить выбор для сравнения. */
export function writeCompareSelection(technologyIds: string[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(technologyIds));
  } catch {
    // ignore
  }
}
