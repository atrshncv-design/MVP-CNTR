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
 * Полная карточка проекта (GET /api/v1/projects/{id}) — типы данных для
 * клиентской страницы /dashboard/project/[id] (тикет 04). Фетч остаётся на
 * странице (клиентский NEXT_PUBLIC_API_URL), типы — единые здесь.
 */
export interface ProjectQuestionnaireResult {
  id: number;
  level_id: number;
  percentage: number;
  checked_items: string[];
}

export interface ProjectControlPoint {
  id: number;
  title: string;
  description: string | null;
  point_type: string;
  status: string;
  decision: string | null;
}

export interface ProjectDocument {
  id: number;
  title: string;
  doc_type: string;
  status: string;
  version: number;
  file_url: string | null;
}

export interface ProjectVerificationDocument {
  id: number;
  title: string;
  comment: string | null;
  file_ref: string | null;
  uploader_name: string | null;
  created_at: string | null;
}

export interface ProjectMember {
  id: number;
  user_id: number;
  role_in_project: string;
  is_priority: boolean;
}

export interface ProjectAuditEntry {
  id: number;
  user_id: number | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface ProjectDetail {
  project: {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    target_level: number;
    current_level: number;
    preliminary_level?: number | null;
    status: string;
    budget: number | null;
    created_by: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    join_token: string | null;
    is_public?: boolean;
    show_preliminary?: boolean;
  };
  questionnaire_results: ProjectQuestionnaireResult[];
  control_points: ProjectControlPoint[];
  documents: ProjectDocument[];
  verification_documents: ProjectVerificationDocument[];
  members: ProjectMember[];
  audit_trail: ProjectAuditEntry[];
}

/** Публичный реестр проектов/технологий (GET /api/v1/projects/registry). */
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

/** Карточка НИОКТР (GET /api/v1/nioktr, /api/v1/nioktr/{registration_number}). */
export interface NioktrCard {
  id: number;
  registration_number: string;
  name: string;
  annotation: string | null;
  keywords: string[];
  nioktr_types: string[];
  state_program: string | null;
  federal_program: string | null;
  created_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ai_area: boolean;
  is_ai_usage: boolean;
  executor_name: string | null;
  executor_short_name: string | null;
  executor_ogrn: string | null;
  executor_territory: string | null;
  customer_name: string | null;
  budgets: Array<{ funds?: string; budget_type?: string }>;
  organization_id: number | null;
  created_at: string | null;
  source?: string | null;
}

/** Организация из реестра НИОКТР (GET /api/v1/nioktr/organizations). */
export interface OrganizationSummary {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  org_type: string | null;
  competencies: string[];
  projects_count: number;
  region: string | null;
}

/** Детальная карточка организации (GET /api/v1/nioktr/organizations/{ogrn}). */
export interface OrganizationDetail extends OrganizationSummary {
  nioktr_cards: NioktrCard[];
}

/** Исполнитель/специалист каталога (GET /api/v1/executors/*). */
export interface ExecutorSummary {
  id: number;
  full_name: string;
  organization: string | null;
  role_slug: string;
  role_name: string;
  competencies: string[];
  completed_projects: number;
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
