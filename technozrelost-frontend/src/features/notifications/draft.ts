// Черновик карточки проекта — localStorage tz:draft:{projectId} (G43, R26.1)
// Почему отдельный модуль: черновик должен пережить 401/RefreshAccessTokenError
// без потери данных. Модалка сессии сохраняет его перед редиректом, после
// логина карточка восстанавливает состояние из этого ключа.

export function draftKey(projectId: number | string): string {
  return `tz:draft:${projectId}`;
}

/** Сохранить черновик (any serializable). */
export function saveDraft(projectId: number | string, data: unknown): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(draftKey(projectId), JSON.stringify(data));
  } catch {
    // quota exceeded — молча
  }
}

/** Загрузить черновик или null. */
export function loadDraft<T = unknown>(projectId: number | string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(draftKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Удалить черновик после успешной публикации. */
export function clearDraft(projectId: number | string): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(draftKey(projectId));
  } catch {
    // ignore
  }
}

/** Есть ли черновик для проекта. */
export function hasDraft(projectId: number | string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(draftKey(projectId)) !== null;
  } catch {
    return false;
  }
}
