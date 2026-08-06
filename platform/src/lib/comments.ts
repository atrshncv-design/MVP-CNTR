/**
 * T-012. Локальное хранилище контекстных комментариев (STATES.md §5).
 *
 * Комментарии привязаны к объекту (технология/запрос/документ/чекпоинт/
 * решение), а не к чату. В P0 (демо) комментарии сохраняются в localStorage
 * этого браузера по ключу `nfr-comments` в форме { [objectId]: Comment[] }.
 *
 * Компоненты: src/components/comments/comment-list.tsx (список) и
 * comment-form.tsx (форма с оптимистичным рендером). ВАЖНО: клиентский слой
 * (window) — все функции безопасны при SSR и ничего не пишут без window.
 */

import type { Comment } from "./types";
import type { VisibilityScope } from "./adapter/types";

export const COMMENTS_KEY = "nfr-comments";

/**
 * Элемент списка комментариев: доменный Comment + флаг локальной отправки
 * (pending — показан оптимистично до завершения сохранения).
 */
export interface CommentItem extends Comment {
  /** true — комментарий показан оптимистично, сохранение ещё идёт. */
  pending?: boolean;
}

const safeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

type CommentsByObject = Record<string, Comment[]>;

function readAllComments(): CommentsByObject {
  const storage = safeStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(COMMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as CommentsByObject;
  } catch {
    return {};
  }
}

function writeAllComments(all: CommentsByObject): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(COMMENTS_KEY, JSON.stringify(all));
  } catch {
    /* private mode и т.п. — комментарий остаётся в состоянии страницы */
  }
}

/** Комментарии объекта ([] — нет/повреждено, не фабрикуем). */
export function readComments(objectId: string): Comment[] {
  const all = readAllComments();
  const list = all[objectId];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is Comment =>
      Boolean(item) &&
      typeof item.id === "string" &&
      typeof item.text === "string" &&
      typeof item.createdAt === "string",
  );
}

/** Сохранить комментарий объекта (дописывает в конец списка). */
export function appendComment(
  objectId: string,
  comment: CommentItem,
): Comment[] {
  const all = readAllComments();
  const list = readComments(objectId);
  const next = [...list, comment];
  all[objectId] = next;
  writeAllComments(all);
  return next;
}

/** Параметры нового комментария (остальное заполняет вызывающий код). */
export interface NewCommentInput {
  objectType: Comment["objectType"];
  objectId: string;
  text: string;
  author: string;
  visibilityScope: VisibilityScope;
}

/** Собрать CommentItem для сохранения (id и createdAt — на клиенте). */
export function buildComment(input: NewCommentInput): CommentItem {
  return {
    id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    objectType: input.objectType,
    objectId: input.objectId,
    author: input.author,
    text: input.text,
    createdAt: new Date().toISOString(),
    visibilityScope: input.visibilityScope,
  };
}
