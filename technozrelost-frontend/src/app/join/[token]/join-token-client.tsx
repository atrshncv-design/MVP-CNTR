"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { CLIENT_API_BASE } from "@/lib/public-api";
import { getJoinRoleOptions } from "@/features/misc/i18n";

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
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  // Роли — резолвером текущей локали через словарь auth (таск 05).
  const joinRoles = getJoinRoleOptions(t);
  const [state, setState] = useState<State>({ kind: "pick_role" });
  const [selectedRole, setSelectedRole] = useState<string>("rd_executor");

  const handleJoin = async (role: string) => {
    setState({ kind: "joining" });
    try {
      const isInvite = token.toUpperCase().startsWith("INV-");
      const endpoint = isInvite ? "/invites/accept" : "/projects/join";
      const res = await fetch(`${CLIENT_API_BASE}/api/v1${endpoint}`, {
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
          message: extractError(data, t("joinFailed")),
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
        message: tErrors("network"),
      });
    }
  };

  if (state.kind === "pick_role" || state.kind === "joining") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tz-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-tz-border bg-tz-surface p-8 shadow-lg">
          <h1 className="mb-2 text-xl font-bold text-tz-fg">
            {t("joinTitle")}
          </h1>
          <p className="mb-6 text-sm text-tz-secondary">
            {t("joinTokenLabel")}{" "}
            <code className="rounded bg-tz-accent-soft px-1 font-mono text-tz-accent">
              {token}
            </code>
          </p>
          <p className="mb-4 text-sm text-tz-secondary">
            {t("joinRoleLabel")}
          </p>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="mb-4 w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg focus:border-tz-accent focus:outline-none focus:ring-1 focus:ring-tz-accent"
          >
            {joinRoles.map((r) => (
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
                {t("joinSubmitting")}
              </span>
            ) : (
              t("joinSubmit")
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
            {t("joinPendingTitle")}
          </h1>
          <p className="text-sm text-tz-secondary">
            {t("joinPendingDesc")}
          </p>
          {state.project && (
            <p className="mt-3 text-sm text-tz-secondary">
              {t("joinProjectLabel")}{" "}
              <span className="font-medium text-tz-fg">
                {state.project.name}
              </span>
            </p>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-tz-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-tz-accent-hover"
          >
            {t("joinCabinet")}
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
            {t("joinErrorTitle")}
          </h1>
          <p className="text-sm text-tz-secondary">{state.message}</p>
          <button
            onClick={() => setState({ kind: "pick_role" })}
            className="mt-6 rounded-lg bg-tz-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-tz-accent-hover"
          >
            {t("joinRetry")}
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
