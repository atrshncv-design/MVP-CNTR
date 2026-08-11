"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { GitPullRequest, Loader2, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type PromotionItem = {
  id: number;
  project_id: number;
  from_level: number;
  to_level: number;
  status: string;
  rejection_reason: string | null;
  attempt_no: number;
  created_at?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  docs_uploaded: "Документы загружены",
  pre_evaluated: "Предварительная оценка пройдена",
  pending_manager: "Ожидает решения менеджера",
  approved: "Одобрено",
  rejected: "Отклонено",
};

/**
 * Лента заявок на повышение УГТ (тикет 27/28 mvp1).
 * Читает GET /projects/{id}/promotion-history (владелец/участник/ЦНТР).
 * Без mock-данных; ошибки API — честный ErrorState.
 */
export default function PromotionHistoryPanel({ projectId }: { projectId: number }) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [items, setItems] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/promotion-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data && typeof data.detail === "string" ? data.detail : `Ошибка загрузки заявок (${res.status}).`
        );
      }
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заявки.");
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    // Асинхронный запуск (setTimeout) — обход react-hooks/set-state-in-effect:
    // setState происходят только после await внутри load.
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) {
    return (
      <div className="tz-card p-6" data-od-id="promotion-history">
        <div className="flex items-center gap-2 text-tz-secondary"><Loader2 size={16} className="animate-spin" /> Загрузка заявок…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tz-card p-6" data-od-id="promotion-history">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-tz-danger">{error}</p>
          <button className="tz-btn tz-btn-secondary" onClick={() => void load()}><RefreshCw size={14} /> Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tz-card p-6" data-od-id="promotion-history">
      <div className="flex items-center gap-2">
        <GitPullRequest size={18} className="text-tz-accent" />
        <h2 className="text-lg font-bold text-tz-fg">Заявки на повышение УГТ</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-tz-secondary">
          Заявок пока нет. Заявка формируется автоматически после полного комплекта документов этапа.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div className="rounded-lg border border-tz-border p-3" key={item.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-tz-muted">попытка {item.attempt_no}</span>
                <span className="tz-badge tz-badge-review">УГТ {item.from_level} → УГТ {item.to_level}</span>
                <span className={`tz-badge ${item.status === "rejected" ? "tz-badge-danger" : item.status === "approved" ? "tz-badge-success" : "tz-badge-review"}`}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
              {item.rejection_reason && (
                <p className="mt-2 text-sm text-tz-secondary">Причина: {item.rejection_reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
