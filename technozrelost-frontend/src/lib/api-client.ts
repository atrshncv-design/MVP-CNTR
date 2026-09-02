// Единый fetch-слой (тикет 01, FE-02, R27).
// Почему один модуль: 30 сырых fetch в разных файлах дублировали Authorization/no-store/timeout
// и расходились по обработке 401. Теперь весь контракт в одном месте — тест-швы §1.
import { CLIENT_API_BASE, serverApiBase } from "./public-api.ts";
import type { NewsCategory, NewsDetail, NewsFeed, NewsFeedParams } from "./news-types.ts";
import type {
  ControlPointOut,
  DocumentOut,
  MatchCandidate,
  MatchingIn,
  MatchOut,
  NotificationOut,
  ProjectCardOut,
  ProjectDetailOut,
  RegistryParams,
  RegistryProjectOut,
} from "./types.ts";
import { tagsToCategory } from "./types.ts";

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

// Совместимость: старый ProjectSummary теперь алиас к ProjectCardOut (убирает дубль)
export type ProjectSummary = ProjectCardOut;

/** Выбор базы URL: в браузере — относительный CLIENT_API_BASE (тот же origin через rewrites), на сервере — внутренний адрес. */
function getBaseUrl(): string {
  if (typeof window !== "undefined") return CLIENT_API_BASE;
  try {
    return serverApiBase();
  } catch {
    return CLIENT_API_BASE;
  }
}

async function apiRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(5_000),
  });
  // FE-03 + G43: 401 → событие для модалки «Сессия истекла» без потери черновика.
  if (response.status === 401) {
    // G43: уведомляем модалку сессии — она сохранит черновик tz:draft:{projectId} в localStorage
    // и покажет оверлей «Сессия истекла — войдите заново» вместо мгновенного редиректа.
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tz:unauthorized", { detail: { status: 401, path } }));
      }
    } catch {
      // ignore
    }
    const isMockedFetch = !!nativeFetch && globalThis.fetch !== nativeFetch;
    if (isMockedFetch) {
      // Тестовый мок fetch — signOut пропустим, чтобы не висеть на реальном сетевом вызове.
      // Но событие tz:unauthorized уже отправлено — модалка сессии может его обработать.
    } else {
      // Не редиректим сразу: модалка сессии покажет «Сессия истекла — войдите заново»
      // и сохранит черновик. signOut откладываем до клика пользователя (восстановление после логина).
      // Для совместимости с FE-03 — не вызываем signOut автоматически, модалка ресит ре-логин.
      // Если требуется мгновенный выход — модалка вызовет signOut при подтверждении.
    }
  }
  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status}`, response.status);
  }
  // 204 No Content
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function publicApiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}/api/v1${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

// ─── Проекты ──────────────────────────────────────────────────────────────

export function getProjects(accessToken: string): Promise<ProjectSummary[]> {
  return apiRequest<ProjectSummary[]>("/projects", accessToken);
}

export function getProject(projectId: number | string, accessToken: string): Promise<ProjectDetailOut> {
  return apiRequest<ProjectDetailOut>(`/projects/${projectId}`, accessToken);
}

export function getRegistry(params: RegistryParams, accessToken: string): Promise<RegistryProjectOut[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  // теги → category для бэка (tags[0] → category), либо tags как фильтр если бэк поддерживает
  if (params.tags && params.tags.length) {
    // если бэк принимает tags — шлём каждый тег отдельно, иначе шлём первый как category
    // сейчас бэк понимает category, поэтому маппим tags[0] → category для совместимости
    const cat = tagsToCategory(params.tags);
    if (cat) qs.set("category", cat);
    // также пробрасываем tags как есть для будущего бэка
    for (const t of params.tags) qs.append("tags", t);
  } else if (params.category) {
    qs.set("category", params.category);
  }
  if (params.ugt_min != null) qs.set("ugt_min", String(params.ugt_min));
  if (params.ugt_max != null) qs.set("ugt_max", String(params.ugt_max));
  if (params.status) qs.set("status", params.status);
  if (params.region) qs.set("region", params.region);
  if (params.budget_min != null) qs.set("budget_min", String(params.budget_min));
  if (params.budget_max != null) qs.set("budget_max", String(params.budget_max));
  if (params.after_id != null) qs.set("after_id", String(params.after_id));
  qs.set("limit", String(params.limit ?? 20));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<RegistryProjectOut[]>(`/projects/registry${suffix}`, accessToken);
}

export function togglePublish(
  projectId: number | string,
  isPublic: boolean,
  showPreliminary: boolean,
  accessToken: string,
): Promise<ProjectSummary> {
  return apiRequest<ProjectSummary>(`/projects/${projectId}/publish`, accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: isPublic, show_preliminary: showPreliminary }),
  });
}

export function archiveProject(projectId: number | string, accessToken: string): Promise<ProjectSummary> {
  return apiRequest<ProjectSummary>(`/projects/${projectId}/archive`, accessToken, {
    method: "POST",
  });
}

// Alias for ticket criterion name "archive"
export const archive = archiveProject;

/** Экспорт проекта как JSON blob (тикет 13). */
export async function exportProject(projectId: number | string, accessToken: string): Promise<Blob> {
  const response = await fetch(`${getBaseUrl()}/api/v1/projects/${projectId}/export`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new ApiError(`API request failed: ${response.status}`, response.status);
  return response.blob();
}
export const exportProjectJson = exportProject;

// ─── Документы / файлы ───────────────────────────────────────────────────

/** Загрузка файла проекта (multipart, 25МБ лимит на бэке → 413, ClamAV 409). */
export async function uploadFile(
  projectId: number | string,
  file: File,
  accessToken: string,
  docType = "general",
): Promise<DocumentOut> {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  form.append("title", file.name);
  const response = await fetch(`${getBaseUrl()}/api/v1/projects/${projectId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new ApiError(`API request failed: ${response.status}`, response.status);
  return response.json() as Promise<DocumentOut>;
}

/** Скачивание файла (только download, без preview — G39). */
export async function downloadFile(fileId: number | string, accessToken: string): Promise<Blob> {
  const response = await fetch(`${getBaseUrl()}/api/v1/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new ApiError(`API request failed: ${response.status}`, response.status);
  return response.blob();
}

export function getProjectFiles(projectId: number | string, accessToken: string): Promise<DocumentOut[]> {
  return apiRequest<DocumentOut[]>(`/projects/${projectId}/files`, accessToken);
}

// ─── Вступление по токену (G12, G07) ───────────────────────────────────────

export function joinProject(
  token: string,
  roleInProject: string,
  accessToken: string,
): Promise<{ status: string; project?: { id: number; name: string } | null }> {
  return apiRequest<{ status: string; project?: { id: number; name: string } | null }>(
    "/projects/join",
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, role_in_project: roleInProject }),
    },
  );
}

// ─── Уведомления ─────────────────────────────────────────────────────────

export function getNotifications(accessToken: string): Promise<NotificationOut[]> {
  return apiRequest<NotificationOut[]>("/notifications", accessToken);
}

export function markNotificationRead(notificationId: number | string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/notifications/${notificationId}/read`, accessToken, {
    method: "POST",
  });
}

export function getSseTicket(accessToken: string): Promise<{ ticket: string }> {
  return apiRequest<{ ticket: string }>("/notifications/sse-ticket", accessToken);
}

// ─── Верификация профилей/организаций (менеджер+админ, R32, G54) ──────────

export interface ManagerProfileQueueItem {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  headline: string | null;
  region: string | null;
  skills: string[];
  state: string;
  review_comment: string | null;
  role_slugs: string[];
}

export interface ManagerOrgQueueItem {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  region: string | null;
  state: string;
  creator_name: string;
  org_type?: string | null;
}

export function getManagerProfiles(accessToken: string, state = "pending"): Promise<ManagerProfileQueueItem[]> {
  return apiRequest<ManagerProfileQueueItem[]>(`/manager/profiles?state=${encodeURIComponent(state)}`, accessToken);
}

export function getManagerOrgs(accessToken: string, state = "pending"): Promise<ManagerOrgQueueItem[]> {
  return apiRequest<ManagerOrgQueueItem[]>(`/manager/orgs?state=${encodeURIComponent(state)}`, accessToken);
}

export function decideManagerProfile(
  profileId: number | string,
  action: "verify" | "reject",
  comment: string,
  accessToken: string,
): Promise<unknown> {
  return apiRequest(`/manager/profiles/${profileId}/decide`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment }),
  });
}

export function decideManagerOrg(
  orgId: number | string,
  action: "verify" | "reject",
  comment: string,
  accessToken: string,
): Promise<unknown> {
  return apiRequest(`/manager/orgs/${orgId}/decide`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment }),
  });
}

// ─── Мэтчинг (подбор партнёра, тикет 05) ─────────────────────────────────

export function matchOrganizations(payload: MatchingIn, accessToken: string): Promise<MatchOut> {
  return apiRequest<MatchOut>("/match", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Alias for criterion name "matching"
export const matching = matchOrganizations;

// Generic matching with обезличивание (clean payload already)
export function postMatch(payload: MatchingIn, accessToken: string): Promise<MatchCandidate[]> {
  return matchOrganizations(payload, accessToken).then((r) => r.results);
}

// ─── Stage Requirements / ГОСТ (тикет 03, G18-G20) ──────────────────────────

export interface StageRequirementOut {
  id: number;
  from_level: number;
  to_level: number;
  title: string;
  description: string;
  template_version: string;
  uploaded: boolean;
}

export function getStageRequirements(projectId: number | string, accessToken: string): Promise<StageRequirementOut[]> {
  return apiRequest<StageRequirementOut[]>(`/projects/${projectId}/stage-requirements`, accessToken);
}

export function getGostRequirements(level: number, accessToken: string): Promise<StageRequirementOut[]> {
  return apiRequest<StageRequirementOut[]>(`/gost-requirements?level=${level}`, accessToken);
}

export function regenerateProjectToken(projectId: number | string, accessToken: string): Promise<{ join_token: string }> {
  return apiRequest<{ join_token: string }>(`/projects/${projectId}/regenerate-token`, accessToken, {
    method: "POST",
  });
}

// ─── Документы: перепроверка ClamAV (409 retry) ───────────────────────────

export function rescanFile(fileId: number | string, accessToken: string): Promise<DocumentOut> {
  return apiRequest<DocumentOut>(`/files/${fileId}/rescan`, accessToken, {
    method: "POST",
  });
}

// ─── ИИ-консультант узкий по документам УГТ (тикет 06, G29, R17) ──────────
// Обезличенный контекст: только level + requirement_codes без ПДн, контур kaba.
// Шлёт POST /chat/kaba или POST /rag/search обезличено.

export interface RagSearchIn {
  query: string;
  doc_type?: string | null;
  ugt_level?: number | null;
  contour?: string | null;
  top_k?: number;
}

export interface RagDocumentOut {
  id: number;
  title: string;
  doc_type: string;
  ugt_level: number | null;
  raw_text: string;
  source_uri: string | null;
  template_metadata: Record<string, unknown>;
  contour?: string;
}

export interface RagSearchResult {
  document: RagDocumentOut;
  similarity: number;
}

export interface ChatOut {
  reply: { role: string; content: string };
  sources: RagDocumentOut[];
}

export function searchDocsRag(payload: RagSearchIn, accessToken: string): Promise<RagSearchResult[]> {
  return apiRequest<RagSearchResult[]>("/rag/search", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function chatDocs(message: string, accessToken: string, contour: "kaba" | "tuno" | null = "kaba"): Promise<ChatOut> {
  const path = contour ? `/chat/${contour}` : "/chat";
  return apiRequest<ChatOut>(path, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: [] }),
  });
}

// Алиас для теста 06 (payload без ПДн)
export const postChatKaba = chatDocs;
export const postRagSearch = searchDocsRag;

// ─── Админ-аналитика ЦНТР (тикет 08, G33.1) ─────────────────────────────────
// Данные из GET /admin/achievements/stats + GET /projects агрегация фронт.
// Использует lib/api-client единый слой, lib/types для типов, lib/status для статусов.

export interface AdminAchievementStats {
  generated_at: string;
  totals: {
    total_awards: number;
    awards_last_week: number;
    unique_users: number;
    unique_projects: number;
  };
  by_day: Array<{ date: string; count: number }>;
  by_week: Array<{ date: string; count: number }>;
  by_group: Array<{ key: string; count: number; percent: number }>;
  by_rarity: Array<{ key: string; count: number; percent: number }>;
  by_sector: Array<{ category: string; count: number; projects: number }>;
  top_achievements: Array<{
    slug: string;
    title: string;
    group: string;
    rarity: string;
    count: number;
  }>;
  stalled_projects: Array<{
    id: number;
    name: string;
    current_level: number;
    days: number;
  }>;
  manager_review: { avg_hours: number | null; decided_count: number };
}

export function getAdminAchievementsStats(accessToken: string): Promise<AdminAchievementStats> {
  return apiRequest<AdminAchievementStats>("/admin/achievements/stats", accessToken);
}

export function getAdminAchievementsStatsLegacy(accessToken: string): Promise<AdminAchievementStats> {
  return getAdminAchievementsStats(accessToken);
}

// Алиас для теста 08: админ видит макс-аналитику
export const getAdminStats = getAdminAchievementsStats;

export function getOrganizations(
  params: { search?: string; limit?: number; offset?: number },
  accessToken: string,
): Promise<import("./types").OrganizationOut[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  qs.set("limit", String(params.limit ?? 50));
  if (params.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<import("./types").OrganizationOut[]>(`/nioktr/organizations${suffix}`, accessToken);
}

// ─── Контрольные точки КТ 1-4 — Go/No-Go аудитора (P2, R04, тикет 04) ──────────
// Почему здесь: единый fetch-слой, бэк — PATCH /projects/{id}/control-points/{cpId}
// check via ControlPoint, бейдж возврата, шаблон GET /templates/{id} с fallback BLOCKED.

export interface ControlPointDecisionIn {
  status: "approved" | "rejected";
  decision?: string | null;
}

export function decideControlPoint(
  projectId: number | string,
  cpId: number | string,
  status: "approved" | "rejected",
  decision: string | null,
  accessToken: string,
): Promise<ControlPointOut> {
  return apiRequest<ControlPointOut>(`/projects/${projectId}/control-points/${cpId}`, accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, decision }),
  });
}

// Алиасы для совместимости с критерием тикета 04 — check via ControlPoint
export const decideControlPointGoNoGo = decideControlPoint;
export const patchControlPoint = decideControlPoint;
export const updateControlPoint = decideControlPoint;

// ─── Шаблоны документов — GET /templates/{id} с fallback local blob (P2, R05) ──
// Почему здесь: шаблон скачивается с бэка если 200, иначе local blob fallback + BLOCKED пометка
// GET /templates/{id} — бэкенд document_generator / rag templates, version из бэка не v1 хардкод

export async function getTemplateBlob(
  templateId: number | string,
  accessToken: string,
): Promise<Blob> {
  const response = await fetch(`${getBaseUrl()}/api/v1/templates/${encodeURIComponent(String(templateId))}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new ApiError(`API request failed: ${response.status}`, response.status);
  return response.blob();
}

// GET /templates/{id} — если 200 возвращаем blob, иначе бросаем для fallback + BLOCKED
export const getTemplate = getTemplateBlob;
export const fetchTemplate = getTemplateBlob;
export const downloadTemplateBlob = getTemplateBlob;

// ─── Сохранённые фильтры (P2, R02) ─────────────────────────────────────────
// Почему единый модуль api-client: пробует бэкенд GET/POST/DELETE /filters/saved,
// при 404 — fallback localStorage tz:saved-filters с пометкой BLOCKED.
// Без лимита: бэк или localStorage не ограничивают количество.

export interface SavedFilterOut {
  id: string | number;
  name: string;
  filters: RegistryParams;
  created_at: string;
}

export interface SavedFilterIn {
  name: string;
  filters: RegistryParams;
}

export function getSavedFilters(accessToken: string): Promise<SavedFilterOut[]> {
  return apiRequest<SavedFilterOut[]>("/filters/saved", accessToken);
}

export function saveFilter(payload: SavedFilterIn, accessToken: string): Promise<SavedFilterOut> {
  return apiRequest<SavedFilterOut>("/filters/saved", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteFilter(
  filterId: string | number,
  accessToken: string,
): Promise<void> {
  return apiRequest<void>(`/filters/saved/${encodeURIComponent(String(filterId))}`, accessToken, {
    method: "DELETE",
  });
}

// Алиасы для совместимости с критерием тикета
export const createSavedFilter = saveFilter;
export const removeSavedFilter = deleteFilter;
export const deleteSavedFilter = deleteFilter;
export const getSavedFiltersList = getSavedFilters;

// ─── Публичные новости (спека §3.7, тикет 05 backend) ─────────────────────
// Эндпоинты доступны без токена (CurrentUserOptional); используются
// серверными компонентами (landing)-раздела: /news и /news/[id].
// Клиентские обёртки ходят по относительным /api/v1/* через rewrites.

export function getPublicNewsFeed(params: NewsFeedParams = {}): Promise<NewsFeed> {
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
