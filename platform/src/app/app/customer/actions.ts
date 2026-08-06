/**
 * T-008. Server actions кабинета заказчика.
 *
 * Единственная точка вызова адаптера (T-004) из клиентских компонентов:
 * адаптер серверный (импортирует JSON-датасет), поэтому форма запроса и
 * комментарии обращаются к нему через эти действия. Сигнатуры совпадают
 * с методами PlatformDataAdapter (saveDraft / submitForReview / addComment),
 * scope для кабинетных объектов — "participant".
 */

"use server";

import { getAdapter } from "@/lib/adapter";
import type { Comment, SaveResult, SubmissionResult } from "@/lib/types";

/** Поля формы запроса заказчика (T-008). */
export interface RequestFormPayload {
  problemStatement: string;
  constraints: string[];
  industry: string;
  implementationContext: string;
  desiredCapability: string;
}

/**
 * Сохранить черновик запроса (кнопка «Сохранить черновик»).
 * id формируется на клиенте; mock-адаптер возвращает SaveResult.
 */
export async function saveRequestDraft(input: {
  id: string;
  fields: RequestFormPayload;
}): Promise<SaveResult> {
  const adapter = getAdapter();
  return adapter.saveDraft({
    objectType: "request",
    id: input.id,
    payload: { ...input.fields },
  });
}

/**
 * Подать запрос на проверку: сохраняет финальные данные и переводит
 * в статус under_review («На проверке» по STATES.md §1).
 */
export async function submitRequestDraft(input: {
  id: string;
  fields: RequestFormPayload;
}): Promise<{ save: SaveResult; submission: SubmissionResult }> {
  const adapter = getAdapter();
  const save = await adapter.saveDraft({
    objectType: "request",
    id: input.id,
    payload: { ...input.fields },
  });
  const submission = await adapter.submitForReview({
    objectType: "request",
    id: input.id,
    scope: "participant",
  });
  return { save, submission };
}

/** Добавить комментарий к запросу (STATES.md §5 — комментарии контекстные). */
export async function addRequestComment(input: {
  objectId: string;
  text: string;
}): Promise<Comment> {
  const adapter = getAdapter();
  return adapter.addComment({
    objectType: "request",
    objectId: input.objectId,
    text: input.text,
    scope: "participant",
  });
}
