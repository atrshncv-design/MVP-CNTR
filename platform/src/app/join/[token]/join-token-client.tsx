"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const JOIN_ROLES = [
  { value: "rd_executor", label: "R&D-исполнитель" },
  { value: "scientific_org", label: "Научная организация" },
  { value: "serial_manufacturer", label: "Серийный производитель" },
  { value: "regulating_organization", label: "Регулирующая организация" },
  { value: "auditor", label: "Аудитор" },
  { value: "investor", label: "Инвестор" },
  { value: "participant", label: "Участник проекта" },
  { value: "tech_lead", label: "Технический руководитель" },
  { value: "project_curator", label: "Куратор проекта" },
] as const;

interface JoinResponse {
  status: "active" | "pending";
  project: { id: number; name: string } | null;
  project_id?: number;
  project_name?: string;
  role_in_project?: string;
}

function extractError(data: unknown, fallback: string): string {
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

type State =
  | { kind: "loading" }
  | { kind: "pick_role" }
  | { kind: "joining" }
  | { kind: "active"; project: { id: number; name: string } }
  | { kind: "pending"; project: { id: number; name: string } | null }
  | { kind: "error"; message: string };

export default function JoinTokenClient({
  token,
  accessToken,
}: {
  token: string;
  accessToken: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "pick_role" });
  const [selectedRole, setSelectedRole] = useState<string>("rd_executor");

  const handleJoin = async (role: string) => {
    setState({ kind: "joining" });
    try {
      const isInvite = token.toUpperCase().startsWith("INV-");
      const endpoint = isInvite ? "/api/v1/invites/accept" : "/api/v1/projects/join";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, role_in_project: role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setState({
          kind: "error",
          message: extractError(data, "Не удалось присоединиться к проекту"),
        });
        return;
      }

      const data = (await res.json()) as JoinResponse;
      const project =
        data.project ??
        (data.project_id ? { id: data.project_id, name: data.project_name ?? "" } : null);
      if (data.status === "active" && project) {
        router.replace(`/dashboard/project/${project.id}`);
      } else {
        setState({
          kind: "pending",
          project,
        });
      }
    } catch {
      setState({
        kind: "error",
        message: "Сетевая ошибка. Проверьте подключение и попробуйте снова.",
      });
    }
  };

  if (state.kind === "pick_role" || state.kind === "joining") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tz-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-tz-border bg-tz-surface p-8 shadow-lg">
          <h1 className="mb-2 text-xl font-bold text-tz-fg">
            Вступление в проект
          </h1>
          <p className="mb-6 text-sm text-tz-secondary">
            Токен{" "}
            <code className="rounded bg-tz-accent-soft px-1 font-mono text-tz-accent">
              {token}
            </code>
          </p>
          <p className="mb-4 text-sm text-tz-secondary">
            Выберите роль в проекте:
          </p>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="mb-4 w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg focus:border-tz-accent focus:outline-none focus:ring-1 focus:ring-tz-accent"
          >
            {JOIN_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleJoin(selectedRole)}
            disabled={state.kind === "joining"}
            className="w-full rounded-lg bg-tz-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-tz-accent-hover disabled:opacity-50"
          >
            {state.kind === "joining" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Вступление…
              </span>
            ) : (
              "Присоединиться"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tz-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-tz-border bg-tz-surface p-8 text-center shadow-lg">
          <AlertCircle
            size={48}
            className="mx-auto mb-4 text-tz-warning"
          />
          <h1 className="mb-2 text-xl font-bold text-tz-fg">
            Заявка отправлена
          </h1>
          <p className="text-sm text-tz-secondary">
            Ваша заявка на вступление в проект передана на рассмотрение
            владельцу. Вы получите доступ после одобрения.
          </p>
          {state.project && (
            <p className="mt-3 text-sm text-tz-secondary">
              Проект:{" "}
              <span className="font-medium text-tz-fg">
                {state.project.name}
              </span>
            </p>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-tz-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-tz-accent-hover"
          >
            Перейти в личный кабинет
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tz-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-tz-border bg-tz-surface p-8 text-center shadow-lg">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-tz-danger" />
          <h1 className="mb-2 text-xl font-bold text-tz-fg">
            Не удалось присоединиться
          </h1>
          <p className="text-sm text-tz-secondary">{state.message}</p>
          <button
            onClick={() => setState({ kind: "pick_role" })}
            className="mt-6 rounded-lg bg-tz-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-tz-accent-hover"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // loading fallback (shouldn't normally reach)
  return (
    <div className="flex min-h-screen items-center justify-center bg-tz-bg">
      <Loader2 size={32} className="animate-spin text-tz-accent" />
    </div>
  );
}
