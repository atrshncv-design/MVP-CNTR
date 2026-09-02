/**
 * Авторизованные запросы новостного раздела для ЛК (тикет 08, спека §3.3/§3.7).
 *
 * Все вызовы — из браузера (клиентские компоненты ЛК): относительный путь
 * /api/v1/* уходит на бэкенд через rewrites (next.config.ts), токен —
 * Bearer из сессии NextAuth (session.user.accessToken).
 *
 * Покрывает: консоль /news/admin-list (тикет 08), редактор
 * (create/update/publish/schedule/unpublish/delete), media-загрузки.
 * Поля source/created_automatically здесь не используются — их ставит
 * бэкенд (source=manual, создание только через POST /news).
 */

import type {
  NewsCategory,
  NewsDetail,
  NewsMedia,
  NewsStatus,
} from "@/lib/news-types";
import { CLIENT_API_BASE } from "@/lib/public-api";


/** Тело создания/редактирования новости (NewsCreateIn/NewsUpdateIn). */
export interface NewsPayload {
  title: string;
  content: string;
  category_id: number | null;
  tags: string[];
}

/** Извлечение человекочитаемой ошибки из тела FastAPI (detail|массив {msg}). */
export function extractApiError(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (
      Array.isArray(detail) &&
      detail[0] &&
      typeof detail[0] === "object"
    ) {
      const msg = (detail[0] as { msg?: unknown }).msg;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}

async function request<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${CLIENT_API_BASE}/api/v1${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      extractApiError(data, `Запрос не выполнен (${response.status}).`),
    );
  }
  return data as T;
}

/** Консоль: все (админ) / свои (менеджер) новости, фильтр по статусу. */
export function getAdminNewsList(
  token: string,
  status?: NewsStatus | "all",
): Promise<NewsDetail[]> {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  const qs = params.toString();
  return request<NewsDetail[]>(`/news/admin-list${qs ? `?${qs}` : ""}`, token);
}

/** Полная карточка (автор/админ видят черновики; чужие черновики — 404). */
export function getNewsDetail(
  token: string,
  id: number | string,
): Promise<NewsDetail> {
  return request<NewsDetail>(`/news/${id}`, token);
}

/** Категории для select в редакторе и фильтров консоли (публичный). */
export function getNewsCategories(): Promise<NewsCategory[]> {
  return request<NewsCategory[]>("/news/categories", "");
}

/** Создать новость (cntr_admin/cntr_manager; всегда source=manual). */
export function createNews(
  token: string,
  payload: NewsPayload,
  status: NewsStatus = "draft",
): Promise<NewsDetail> {
  return request<NewsDetail>("/news", token, {
    method: "POST",
    body: { ...payload, status },
  });
}

/** Отредактировать (автор/cntr_admin; published_at не меняется — §3.5). */
export function updateNews(
  token: string,
  id: number,
  payload: NewsPayload,
): Promise<NewsDetail> {
  return request<NewsDetail>(`/news/${id}`, token, {
    method: "PATCH",
    body: payload,
  });
}

/** Опубликовать сейчас (draft/scheduled → published). */
export function publishNews(token: string, id: number): Promise<NewsDetail> {
  return request<NewsDetail>(`/news/${id}/publish`, token, {
    method: "POST",
  });
}

/** Отложить публикацию ({scheduled_at} в будущем). */
export function scheduleNews(
  token: string,
  id: number,
  scheduledAt: string,
): Promise<NewsDetail> {
  return request<NewsDetail>(`/news/${id}/schedule`, token, {
    method: "POST",
    body: { scheduled_at: scheduledAt },
  });
}

/** Снять с публикации → draft (следующая публикация ставит новый published_at). */
export function unpublishNews(
  token: string,
  id: number,
): Promise<NewsDetail> {
  return request<NewsDetail>(`/news/${id}/unpublish`, token, {
    method: "POST",
  });
}

/** Удалить новость вместе с media-файлами (204). */
export async function deleteNews(
  token: string,
  id: number,
): Promise<void> {
  await request<null>(`/news/${id}`, token, { method: "DELETE" });
}

/** Загрузить медиа: kind = cover|inline|attachment|gallery (multipart). */
export function uploadNewsMedia(
  token: string,
  id: number,
  file: File,
  kind: string,
): Promise<NewsMedia> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  return request<NewsMedia>(`/news/${id}/media`, token, {
    method: "POST",
    body: form,
  });
}

/** Удалить медиа (204); обложка сбрасывается, если удалена она. */
export async function deleteNewsMedia(
  token: string,
  id: number,
  mediaId: number,
): Promise<void> {
  await request<null>(`/news/${id}/media/${mediaId}`, token, {
    method: "DELETE",
  });
}
