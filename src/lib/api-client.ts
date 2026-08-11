// Серверный URL бэкенда (модуль используется только серверными компонентами).
// Не NEXT_PUBLIC_: читается в рантайме, не инлайнится в клиентские бандлы.
const API_URL = process.env.API_URL_INTERNAL ?? "http://127.0.0.1:8000";

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

/**
 * Элемент списка GET /projects (ProjectOut): плоский объект, который backend
 * возвращает с control_points и verification_documents_count (FE-004, без N+1).
 * ВАЖНО: documents/members в списке НЕТ — только в карточке GET /projects/{id}.
 */
export interface ProjectListItem extends ProjectSummary {
  control_points: ControlPoint[];
  verification_documents_count: number;
}

/** Контрольная точка проекта (ControlPointOut). */
export interface ControlPoint {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  point_type: string;
  status: string;
  decision: string | null;
  decided_by: number | null;
  decided_at: string | null;
  created_at: string | null;
}

/** Верифицирующий документ («подтверждение УГТ», VerificationDocOut). */
export interface VerificationDocument {
  id: number;
  project_id: number;
  uploader_id: number;
  uploader_name: string | null;
  title: string;
  comment: string | null;
  file_ref: string | null;
  created_at: string | null;
}

/** Элемент реестра публичных проектов (RegistryProjectOut, GET /projects/registry). */
export interface RegistryProject {
  id: number;
  name: string;
  category: string | null;
  current_level: number;
  preliminary_level: number | null;
  target_level: number;
  budget: number | null;
  organization: string | null;
  is_public: boolean;
  show_preliminary: boolean;
  published_at: string | null;
  created_at: string | null;
}

/** Карточка проекта (ProjectDetailOut, GET /projects/{id}). */
export interface ProjectDetail {
  project: ProjectSummary;
  control_points: ControlPoint[];
  documents: Array<{
    id: number;
    title: string;
    doc_type: string;
    file_url: string | null;
    status: string;
    version: number;
  }>;
  verification_documents: VerificationDocument[];
  members: Array<{
    id: number;
    user_id: number;
    role_in_project: string;
    status: string;
    is_priority: boolean;
  }>;
}

/** Результат вступления по токену (JoinResultOut). */
export interface JoinProjectResult {
  status: "active" | "pending";
  project: ProjectSummary | null;
}

/* ------------------------------------------------------------------ */
/*  Типы рабочих кабинетов (тикет 02, internal-frontend)               */
/*  Контракты сверены с реальными ответами backend (app/api/v1/*).     */
/* ------------------------------------------------------------------ */

/** Карточка-черновик из очереди менеджера (GET /manager/queue/drafts). */
export interface DraftProject {
  id: number;
  name: string;
  description: string | null;
  preliminary_level: number | null;
  current_level: number;
  target_level: number;
  status: string;
  rejection_reason: string | null;
}

/** Заявка на повышение УГТ (GET /manager/queue/promotions). */
export interface PromotionRequest {
  id: number;
  project_id: number;
  project_name: string;
  from_level: number;
  to_level: number;
  status: string;
  rejection_reason: string | null;
  attempt_no: number;
  evaluation_result: {
    success?: boolean;
    missing?: string[];
    summary?: string;
  };
  verification_docs: Array<{ id: number; title: string }>;
}

/** Пользователь админ-реестра (GET /users, PATCH /users/{id}). */
export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  organization: string | null;
  is_active: boolean;
  roles: Array<{ role_no: number; slug: string; name: string }>;
  created_at: string;
}

/** Запись глобального аудита (GET /admin/audit — только cntr_admin). */
export interface AuditEntry {
  id: number;
  project_id: number | null;
  user_id: number | null;
  user_name: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  Транспорт                                                          */
/* ------------------------------------------------------------------ */

/** Достаёт человекочитаемое сообщение об ошибке из ответа FastAPI. */
function extractErrorDetail(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const msg = (detail[0] as { msg?: unknown }).msg;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}

interface ApiInit {
  method?: string;
  body?: unknown;
}

/**
 * Единый транспорт API-клиента: Authorization: Bearer, no-store,
 * таймаут 5с, любая ошибка (400/401/403/404/429/5xx) → ApiError со
 * статусом и сообщением backend (detail). Страницы кабинетов используют
 * только эти функции — никаких inline mock-массивов и «успеха» на ошибке.
 */
async function apiRequest<T>(
  path: string,
  accessToken: string,
  init?: ApiInit,
): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      extractErrorDetail(data, `API request failed: ${response.status}`),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  Проекты (общие реестры — любая авторизованная роль)                */
/* ------------------------------------------------------------------ */

export function getProjects(accessToken: string): Promise<ProjectListItem[]> {
  return apiRequest<ProjectListItem[]>("/projects", accessToken);
}

/**
 * Реестр публичных проектов (GET /projects/registry) — только is_public.
 * Параметры фильтров совпадают с backend (ugt_min/ugt_max/category/budget_*).
 * Используется инвестором и серийным производителем (реестр технологий УГТ 7+).
 */
export function getProjectRegistry(
  accessToken: string,
  params: {
    ugt_min?: number;
    ugt_max?: number;
    category?: string;
    budget_min?: number;
    budget_max?: number;
  } = {},
): Promise<RegistryProject[]> {
  const qs = new URLSearchParams();
  if (params.ugt_min !== undefined) qs.set("ugt_min", String(params.ugt_min));
  if (params.ugt_max !== undefined) qs.set("ugt_max", String(params.ugt_max));
  if (params.category !== undefined) qs.set("category", params.category);
  if (params.budget_min !== undefined) qs.set("budget_min", String(params.budget_min));
  if (params.budget_max !== undefined) qs.set("budget_max", String(params.budget_max));
  const query = qs.toString();
  return apiRequest<RegistryProject[]>(`/projects/registry${query ? `?${query}` : ""}`, accessToken);
}

/** Карточка проекта (GET /projects/{id}) — documents/members/verification_documents. */
export function getProjectDetail(
  accessToken: string,
  projectId: number,
): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>(`/projects/${projectId}`, accessToken);
}

/**
 * Решение по контрольной точке (PATCH /projects/{id}/control-points/{cp_id}).
 * Backend: verifier = superuser | cntr_staff | regulating_organization | auditor.
 * Любая другая роль, не участник проекта → 403 «Недостаточно прав» (или 404).
 */
export function decideControlPoint(
  accessToken: string,
  projectId: number,
  cpId: number,
  payload: { status: "approved" | "rejected"; decision?: string | null },
): Promise<ControlPoint> {
  return apiRequest<ControlPoint>(
    `/projects/${projectId}/control-points/${cpId}`,
    accessToken,
    { method: "PATCH", body: payload },
  );
}

/**
 * Загрузка верифицирующего документа (POST /projects/{id}/verification-docs).
 * Backend: до вступления по токену — 403 «Сначала присоединитесь к проекту…».
 */
export function uploadVerificationDoc(
  accessToken: string,
  projectId: number,
  payload: { title: string; comment?: string | null; file_ref?: string | null },
): Promise<VerificationDocument> {
  return apiRequest<VerificationDocument>(
    `/projects/${projectId}/verification-docs`,
    accessToken,
    { method: "POST", body: payload },
  );
}

/**
 * Вступление в проект по токену (POST /projects/join).
 * Backend: неверный токен → 404 «Токен недействителен».
 */
export function joinProject(
  accessToken: string,
  payload: { token: string; role_in_project: string },
): Promise<JoinProjectResult> {
  return apiRequest<JoinProjectResult>("/projects/join", accessToken, {
    method: "POST",
    body: payload,
  });
}

export function getExecutors(accessToken: string): Promise<unknown[]> {
  return apiRequest<unknown[]>("/executors", accessToken);
}

/* ------------------------------------------------------------------ */
/*  Кабинет менеджера ЦНТР (/manager/* — cntr_manager + cntr_admin)    */
/* ------------------------------------------------------------------ */

export function getManagerDraftQueue(
  accessToken: string,
): Promise<DraftProject[]> {
  return apiRequest<DraftProject[]>("/manager/queue/drafts", accessToken);
}

export function decideManagerDraft(
  accessToken: string,
  projectId: number,
  payload: { approve: boolean; level?: number | null; reason?: string },
): Promise<DraftProject> {
  return apiRequest<DraftProject>(`/manager/queue/drafts/${projectId}/decide`, accessToken, {
    method: "POST",
    body: payload,
  });
}

export function getManagerPromotions(
  accessToken: string,
): Promise<PromotionRequest[]> {
  return apiRequest<PromotionRequest[]>("/manager/queue/promotions", accessToken);
}

export function decideManagerPromotion(
  accessToken: string,
  requestId: number,
  payload: { approve: boolean; reason?: string; missing?: string[] },
): Promise<PromotionRequest> {
  return apiRequest<PromotionRequest>(`/manager/queue/promotions/${requestId}/decide`, accessToken, {
    method: "POST",
    body: payload,
  });
}

/* ------------------------------------------------------------------ */
/*  Кабинет администратора ЦНТР (/users, /admin/audit — cntr_admin)    */
/* ------------------------------------------------------------------ */

export function getAdminUsers(accessToken: string): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/users", accessToken);
}

export function updateAdminUser(
  accessToken: string,
  userId: number,
  payload: { roles: string[]; is_active: boolean },
): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/users/${userId}`, accessToken, {
    method: "PATCH",
    body: payload,
  });
}

export function getAdminAudit(
  accessToken: string,
  limit = 100,
): Promise<AuditEntry[]> {
  return apiRequest<AuditEntry[]>(`/admin/audit?limit=${limit}`, accessToken);
}
