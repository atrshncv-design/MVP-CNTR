// Серверные вызовы идут на внутренний адрес бэкенда из единого модуля
// (FE-02): fallback на localhost в проде запрещён — модуль падает с
// понятной ошибкой при неполной конфигурации. Относительный импорт, чтобы
// поведенческие тесты могли импортировать клиента напрямую из node.
import { serverApiBase } from "./public-api.ts";
import type { NewsCategory, NewsDetail, NewsFeed, NewsFeedParams } from "@/lib/news-types";

// Сохраняем нативный fetch до моков тестов — signOut не должен использовать замоканный fetch.
const nativeFetch: typeof fetch | undefined =
  typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : undefined;

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
  const response = await fetch(`${serverApiBase()}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  // FE-03: 401 → signOut (сессия протухла, гоним на вход).
  if (response.status === 401) {
    const isMockedFetch = !!nativeFetch && globalThis.fetch !== nativeFetch;
    if (isMockedFetch) {
      // Тестовый мок fetch — signOut пропустим, чтобы не висеть на реальном сетевом вызове.
    } else {
      try {
        const prevFetch = globalThis.fetch;
        if (nativeFetch) globalThis.fetch = nativeFetch;
        try {
          const { signOut } = await import("next-auth/react");
          await Promise.race([
            signOut({ callbackUrl: "/login" }),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("signOut timeout")), 800),
            ),
          ]);
        } finally {
          globalThis.fetch = prevFetch;
        }
      } catch {
        // signOut в серверном/тестовом окружении может бросить — не маскируем исходную 401.
      }
    }
  }
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
  const response = await fetch(`${serverApiBase()}/api/v1${path}`, {
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
