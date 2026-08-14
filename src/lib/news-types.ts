/**
 * Типы публичного новостного API (спека §3.3, тикет 05 backend).
 * Зеркалит ответы GET /api/v1/news, /api/v1/news/{id}, /api/v1/news/categories.
 */

export interface NewsCategory {
  id: number;
  slug: string;
  name: string;
}

export interface NewsTag {
  id: number;
  slug: string;
  name: string;
}

export interface NewsMedia {
  id: number;
  storage_key: string;
  file_name: string;
  mime_type: string;
  /** cover | inline | gallery | attachment */
  kind: string;
  sort_order: number;
  created_at: string | null;
}

/** Карточка в публичной ленте. */
export interface NewsCard {
  id: number;
  title: string;
  excerpt: string | null;
  cover_key: string | null;
  category: NewsCategory | null;
  tags: NewsTag[];
  published_at: string | null;
  created_at: string | null;
}

/** Полная публикация (GET /news/{id}). */
export interface NewsDetail extends NewsCard {
  content: string;
  author_id: number;
  author_name: string | null;
  status: NewsStatus;
  scheduled_at: string | null;
  source: string;
  created_automatically: boolean;
  media: NewsMedia[];
  updated_at: string | null;
}

/** Статусы новости (спека §3.3): draft → scheduled → published. */
export type NewsStatus = "draft" | "scheduled" | "published";

/** Человекочитаемые подписи статусов для ЛК (консоль, лента, редактор). */
export const NEWS_STATUS_LABELS: Record<NewsStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  published: "Опубликована",
};

/** Страница публичной ленты (page/per_page). */
export interface NewsFeed {
  items: NewsCard[];
  total: number;
  page: number;
  per_page: number;
}

/** Размер страницы публичной ленты (используется сервером и клиентом). */
export const NEWS_PAGE_SIZE = 9;

/** Параметры запроса ленты: фильтры по slug категории/тега. */
export interface NewsFeedParams {
  page?: number;
  perPage?: number;
  category?: string | null;
  tag?: string | null;
}

/** Медиа отсортированы по sort_order (спека §3.2). */
export function sortNewsMedia(media: NewsMedia[]): NewsMedia[] {
  return [...media].sort((a, b) => a.sort_order - b.sort_order);
}
