/**
 * T-012. Локальные документы организации (localStorage, демо P0).
 *
 * Workspace документов (/app/documents) показывает фикстуры документов
 * организации (TechnologyDocument, помечены isFixture) плюс документы,
 * загруженные в этом браузере. Загрузка идёт по машине состояний
 * STATES.md §6 (выбрано → загружается → проверяется → принято | отклонено |
 * ошибка+retry); «Принято» — только после завершения (демо) валидации.
 *
 * Ключ: `nfr-org-documents` — массив загруженных документов.
 * КЛИЕНТСКИЙ слой: безопасен при SSR (нейтральные значения), ничего
 * не пишет без window. Данные не фабрикуются.
 */

import type { Status } from "./types";

export const ORG_DOCUMENTS_KEY = "nfr-org-documents";

/** Документ организации, загруженный пользователем (демо-валидация пройдена). */
export interface LocalOrgDocument {
  id: string;
  title: string;
  /** Тип документа (паспорт, выписка, договор…). */
  kind: string;
  /** Канонический статус (STATES.md §1): загруженный документ — «На проверке». */
  status: Extract<Status, "under_review">;
  uploadedAt: string;
}

const safeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Загруженные документы организации ([] — нет/повреждено). */
export function listOrgDocuments(): LocalOrgDocument[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ORG_DOCUMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalOrgDocument =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.uploadedAt === "string",
    );
  } catch {
    return [];
  }
}

function writeOrgDocuments(list: LocalOrgDocument[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(ORG_DOCUMENTS_KEY, JSON.stringify(list));
  } catch {
    /* private mode и т.п. — документ остаётся в состоянии страницы */
  }
}

/** Сохранить загруженный документ (после завершения проверки файла). */
export function addOrgDocument(input: {
  title: string;
  kind: string;
}): LocalOrgDocument {
  const document: LocalOrgDocument = {
    id: `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    kind: input.kind,
    status: "under_review",
    uploadedAt: new Date().toISOString(),
  };
  writeOrgDocuments([...listOrgDocuments(), document]);
  return document;
}

/** Удалить загруженный документ из workspace. */
export function removeOrgDocument(id: string): void {
  writeOrgDocuments(listOrgDocuments().filter((item) => item.id !== id));
}
