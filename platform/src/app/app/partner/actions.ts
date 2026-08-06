/**
 * T-009. Server actions кабинета исполнителя.
 *
 * Единственная точка вызова адаптера (T-004) из клиентских компонентов
 * кабинета партнёра: адаптер серверный (импортирует JSON-датасет),
 * поэтому форма досье, загрузка свидетельств и ответы на уточнения
 * обращаются к нему через эти действия. Сигнатуры совпадают с методами
 * PlatformDataAdapter (saveDraft / submitForReview / addComment /
 * getTechnology), scope для кабинетных объектов — "participant".
 */

"use server";

import { getAdapter } from "@/lib/adapter";
import type {
  Comment,
  SaveResult,
  SubmissionResult,
  TechnologyDossier,
} from "@/lib/types";

/** Сохранить черновик досье технологии (кнопка «Сохранить черновик»). */
export async function saveTechnologyDraft(input: {
  id: string;
  payload: Record<string, unknown>;
}): Promise<SaveResult> {
  return getAdapter().saveDraft({
    objectType: "technology",
    id: input.id,
    payload: input.payload,
  });
}

/** Подать досье на проверку (статус under_review по STATES.md §1). */
export async function submitTechnologyForReview(input: {
  id: string;
}): Promise<SubmissionResult> {
  return getAdapter().submitForReview({
    objectType: "technology",
    id: input.id,
    scope: "participant",
  });
}

/**
 * Досье технологии в кабинете. Для досье, созданных формой-черновиком,
 * адаптер вернёт null — такие досье читаются из localStorage (T-009).
 */
export async function getTechnologyDossier(
  id: string,
): Promise<TechnologyDossier | null> {
  try {
    return await getAdapter().getTechnology(id, "participant");
  } catch {
    return null;
  }
}

/** Ответ на уточнение — комментарий к технологии (STATES.md §4/§5). */
export async function addTechnologyComment(input: {
  objectId: string;
  text: string;
}): Promise<Comment> {
  return getAdapter().addComment({
    objectType: "technology",
    objectId: input.objectId,
    text: input.text,
    scope: "participant",
  });
}
