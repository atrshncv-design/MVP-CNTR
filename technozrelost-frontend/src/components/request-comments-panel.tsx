"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";


interface ProjectRequest {
  id: number;
  from_level: number;
  to_level: number;
  status: string;
  attempt_no: number;
  rejection_reason: string | null;
  created_at: string | null;
  comments_count: number;
}

interface Comment {
  id: number;
  author_id: number;
  author_name: string;
  body: string;
  created_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  docs_uploaded: "Документы загружены",
  pre_evaluated: "Оценка пройдена",
  evaluation_unavailable: "Оценка недоступна",
  pending_manager: "На проверке у менеджера",
  approved: "Подтверждено",
  rejected: "Отклонено",
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export default function RequestCommentsPanel({ projectId }: { projectId: number }) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/requests`, {
        headers: auth(token),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = (await res.json()) as ProjectRequest[];
      setRequests(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  const loadComments = useCallback(
    async (requestId: number | null) => {
      if (!token || requestId == null) {
        setComments([]);
        return;
      }
      try {
        const res = await fetch(
          `${API_URL}/api/v1/projects/${projectId}/requests/${requestId}/comments`,
          { headers: auth(token), cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setComments(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить комментарии");
      }
    },
    [token, projectId],
  );

  useEffect(() => {
    (async () => {
      await loadRequests();
    })();
  }, [loadRequests]);

  useEffect(() => {
    (async () => {
      await loadComments(selectedId);
    })();
  }, [loadComments, selectedId]);

  const send = async () => {
    if (!token || selectedId == null || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/projects/${projectId}/requests/${selectedId}/comments`,
        {
          method: "POST",
          headers: { ...auth(token), "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : `Ошибка (${res.status})`;
        throw new Error(msg);
      }
      setDraft("");
      await loadComments(selectedId);
      await loadRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить комментарий");
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = async (requestId: number) => {
    if (!token) return;
    try {
      const res = await fetch(
        `${API_URL}/api/v1/projects/${projectId}/requests/${requestId}/conclusion.pdf`,
        { headers: auth(token) },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : `Ошибка (${res.status})`;
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conclusion-${projectId}-${requestId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Заключение ещё не готово");
    }
  };

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="tz-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">Заявки и обсуждение</h2>
        </div>
        <button onClick={() => void loadRequests()} className="tz-btn tz-btn-ghost" aria-label="Обновить">
          <RefreshCw size={15} />
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger-fg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded bg-tz-soft" />
      ) : requests.length === 0 ? (
        <p className="mt-4 text-sm text-tz-secondary">
          Заявок на повышение УГТ пока нет — комплект документов этапа ещё не завершён.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <select
            className="tz-select w-full"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            aria-label="Выбор заявки"
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                Заявка #{r.id} · попытка {r.attempt_no} · УГТ {r.from_level} → {r.to_level} ·{" "}
                {STATUS_LABELS[r.status] ?? r.status} · комментариев: {r.comments_count}
              </option>
            ))}
          </select>

          {selected && (
            <div className="rounded-xl border border-tz-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-tz-secondary">
                  УГТ {selected.from_level} → УГТ {selected.to_level}
                  {selected.rejection_reason && (
                    <span className="ml-2 text-tz-danger-fg">Причина: {selected.rejection_reason}</span>
                  )}
                </p>
                {(selected.status === "approved" || selected.status === "rejected") && (
                  <button
                    onClick={() => void downloadPdf(selected.id)}
                    className="tz-btn tz-btn-secondary"
                  >
                    <FileText size={15} /> PDF-заключение
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {comments.length === 0 ? (
                  <p className="text-sm text-tz-muted">Комментариев пока нет.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="rounded-lg bg-tz-soft px-3 py-2">
                      <p className="text-xs font-semibold text-tz-fg">
                        {c.author_name}
                        <span className="ml-2 font-normal text-tz-muted">{c.created_at ?? ""}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-tz-secondary">{c.body}</p>
                    </div>
                  ))
                )}
              </div>

              {selected.status !== "approved" && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="tz-input flex-1"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) void send();
                    }}
                    placeholder="Комментарий для менеджера…"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={sending || !draft.trim()}
                    className="tz-btn tz-btn-primary"
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
