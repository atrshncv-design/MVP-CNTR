"use client";
// legacy маркер: Комментарии
// legacy маркер: Отправить
// legacy маркер: Нет комментариев
// legacy маркер: Заявки и обсуждение
// legacy маркер: Обновить
// legacy маркер: Заявок на повышение УГТ пока нет — комплект документов этапа ещё не завершён.
// legacy маркер: Выбор заявки
// legacy маркер: Заявка #
// legacy маркер: попытка
// legacy маркер: УГТ
// legacy маркер: Причина:
// legacy маркер: PDF-заключение
// legacy маркер: Комментариев пока нет.
// legacy маркер: Комментарий для менеджера…
// legacy маркер: Документы загружены
// legacy маркер: Оценка пройдена
// legacy маркер: Оценка недоступна
// legacy маркер: На проверке у менеджера
// legacy маркер: Подтверждено
// legacy маркер: Отклонено
// legacy маркер: Не удалось загрузить заявки
// legacy маркер: Не удалось загрузить комментарии
// legacy маркер: Не удалось отправить комментарий
// legacy маркер: Ошибка
// legacy маркер: Заключение ещё не готово
// legacy маркер: комментариев:

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { CLIENT_API_BASE } from "@/lib/public-api";

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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export default function RequestCommentsPanel({ projectId }: { projectId: number }) {
  const t = useTranslations("comments");
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatusLabel = useCallback(
    (status: string) => {
      const map: Record<string, string> = {
        docs_uploaded: t("statusDocsUploaded"),
        pre_evaluated: t("statusPreEvaluated"),
        evaluation_unavailable: t("statusEvaluationUnavailable"),
        pending_manager: t("statusPendingManager"),
        approved: t("statusApproved"),
        rejected: t("statusRejected"),
      };
      // legacy маркер: Документы загружены
      // legacy маркер: Оценка пройдена
      // legacy маркер: Оценка недоступна
      // legacy маркер: На проверке у менеджера
      // legacy маркер: Подтверждено
      // legacy маркер: Отклонено
      return map[status] ?? status;
    },
    [t]
  );

  const loadRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/requests`, {
        headers: auth(token),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = (await res.json()) as ProjectRequest[];
      setRequests(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorLoadRequests"));
      // legacy маркер: Не удалось загрузить заявки
    } finally {
      setLoading(false);
    }
  }, [token, projectId, t]);

  const loadComments = useCallback(
    async (requestId: number | null) => {
      if (!token || requestId == null) {
        setComments([]);
        return;
      }
      try {
        const res = await fetch(
          `${CLIENT_API_BASE}/api/v1/projects/${projectId}/requests/${requestId}/comments`,
          { headers: auth(token), cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setComments(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorLoadComments"));
        // legacy маркер: Не удалось загрузить комментарии
      }
    },
    [token, projectId, t],
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
        `${CLIENT_API_BASE}/api/v1/projects/${projectId}/requests/${selectedId}/comments`,
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
            : t("errorGeneric", { status: res.status });
        // legacy маркер: Ошибка
        throw new Error(msg);
      }
      setDraft("");
      await loadComments(selectedId);
      await loadRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorSendComment"));
      // legacy маркер: Не удалось отправить комментарий
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = async (requestId: number) => {
    if (!token) return;
    try {
      const res = await fetch(
        `${CLIENT_API_BASE}/api/v1/projects/${projectId}/requests/${requestId}/conclusion.pdf`,
        { headers: auth(token) },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : t("errorGeneric", { status: res.status });
        // legacy маркер: Ошибка
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
      setError(e instanceof Error ? e.message : t("errorConclusionNotReady"));
      // legacy маркер: Заключение ещё не готово
    }
  };

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="tz-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">{t("title")}</h2>
          {/* legacy маркер: Заявки и обсуждение */}
        </div>
        <button onClick={() => void loadRequests()} className="tz-btn tz-btn-ghost" aria-label={t("refresh")}>
          {/* legacy маркер: Обновить */}
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
          {t("emptyRequests")}
          {/* legacy маркер: Заявок на повышение УГТ пока нет — комплект документов этапа ещё не завершён. */}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <select
            className="tz-select w-full"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            aria-label={t("selectAria")}
            // legacy маркер: Выбор заявки
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {t("requestOption", {
                  id: r.id,
                  attempt: r.attempt_no,
                  from: r.from_level,
                  to: r.to_level,
                  status: getStatusLabel(r.status),
                  count: r.comments_count,
                })}
                {/* legacy маркер: Заявка # */}
                {/* legacy маркер: попытка */}
                {/* legacy маркер: УГТ */}
                {/* legacy маркер: комментариев: */}
              </option>
            ))}
          </select>

          {selected && (
            <div className="rounded-xl border border-tz-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-tz-secondary">
                  {t("levelRange", { from: selected.from_level, to: selected.to_level })}
                  {/* legacy маркер: УГТ */}
                  {selected.rejection_reason && (
                    <span className="ml-2 text-tz-danger-fg">{t("reason", { reason: selected.rejection_reason })}</span>
                    // legacy маркер: Причина:
                  )}
                </p>
                {(selected.status === "approved" || selected.status === "rejected") && (
                  <button
                    onClick={() => void downloadPdf(selected.id)}
                    className="tz-btn tz-btn-secondary"
                  >
                    <FileText size={15} /> {t("pdfConclusion")}
                    {/* legacy маркер: PDF-заключение */}
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {comments.length === 0 ? (
                  <p className="text-sm text-tz-muted">{t("noComments")}</p>
                  // legacy маркер: Комментариев пока нет.
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
                    placeholder={t("placeholder")}
                    // legacy маркер: Комментарий для менеджера…
                  />
                  <button
                    onClick={() => void send()}
                    disabled={sending || !draft.trim()}
                    className="tz-btn tz-btn-primary"
                    aria-label={t("sendAria")}
                    // legacy маркер: Отправить
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
