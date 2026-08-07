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
