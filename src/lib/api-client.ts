// Серверный URL бэкенда (модуль используется только серверными компонентами).
// Не NEXT_PUBLIC_: читается в рантайме, не инлайнится в клиентские бандлы.
const API_URL = process.env.API_URL_INTERNAL ?? "http://127.0.0.1:8000";

import type { NewsCategory, NewsDetail, NewsFeed, NewsFeedParams } from "@/lib/news-types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface ProjectSummary {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  target_level: number;
  current_level: number;
  status: string;
  budget: number | null;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

async function apiRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

export function getProjects(accessToken: string): Promise<ProjectSummary[]> {
  return apiRequest<ProjectSummary[]>("/projects", accessToken);
}

// ── Публичные новости (спека §3.7, тикет 05 backend) ─────────────────────
// Эндпоинты доступны без токена (CurrentUserOptional); используются
// серверными компонентами (landing)-раздела: /news и /news/[id].
// Клиентские обёртки ходят по относительным /api/v1/* через rewrites.

async function publicApiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

export function getPublicNewsFeed(
  params: NewsFeedParams = {},
): Promise<NewsFeed> {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.perPage != null) query.set("per_page", String(params.perPage));
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  const qs = query.toString();
  return publicApiRequest<NewsFeed>(`/news${qs ? `?${qs}` : ""}`);
}

export function getPublicNewsDetail(id: number | string): Promise<NewsDetail> {
  return publicApiRequest<NewsDetail>(`/news/${id}`);
}

export function getPublicNewsCategories(): Promise<NewsCategory[]> {
  return publicApiRequest<NewsCategory[]>("/news/categories");
}
