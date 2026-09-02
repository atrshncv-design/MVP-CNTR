"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { Users, ShieldCheck, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { CLIENT_API_BASE } from "@/lib/public-api";
import type { ProjectMemberOut } from "@/lib/types";

interface TeamPanelProps {
  projectId: number;
  members?: ProjectMemberOut[];
  className?: string;
}

/**
 * TeamPanel — команда проекта (унифицирован).
 * Показывает участников, роли в проекте, приоритетных.
 */
export function TeamPanel({ projectId, members: initialMembers, className = "" }: TeamPanelProps) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [members, setMembers] = React.useState<ProjectMemberOut[] | null>(initialMembers ?? null);
  const [loading, setLoading] = React.useState(!initialMembers);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (initialMembers) {
      setMembers(initialMembers);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { members: ProjectMemberOut[] };
      setMembers(data.members ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить команду");
    } finally {
      setLoading(false);
    }
  }, [token, projectId, initialMembers]);

  React.useEffect(() => {
    if (!initialMembers) void load();
  }, [load, initialMembers]);

  React.useEffect(() => {
    if (initialMembers) setMembers(initialMembers);
  }, [initialMembers]);

  if (loading) {
    return (
      <div className={`tz-card p-6 ${className}`} data-testid="team-panel">
        <div className="h-20 animate-pulse rounded bg-tz-soft" />
      </div>
    );
  }

  return (
    <section className={`tz-card p-6 ${className}`} data-testid="team-panel" aria-label="Команда проекта">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">Команда</h2>
          {members && <span className="tz-badge tz-badge-neutral">{members.length}</span>}
        </div>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label="Обновить команду">
          <RefreshCw size={15} />
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          {error}
        </div>
      )}

      {!members || members.length === 0 ? (
        <p className="mt-3 text-sm text-tz-muted">Участники не назначены</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              data-testid={`member-${m.id}`}
              className="flex items-center gap-3 rounded-xl border border-tz-border bg-tz-bg px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tz-accent text-sm font-bold text-white">
                {m.role_in_project[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-tz-fg">
                  {m.role_in_project} {m.is_priority && <span className="tz-badge tz-badge-success ml-2">приоритет</span>}
                  {m.is_project_admin && <ShieldCheck size={14} className="ml-2 inline text-tz-success" />}
                </p>
                <p className="font-mono text-xs text-tz-muted">ID: {m.user_id} · статус: {m.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default TeamPanel;
