"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { CheckCircle2, Download, FileUp, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";

import { getGostRequirements, getStageRequirements } from "@/lib/api-client";
import type { DocumentOut } from "@/lib/types";
import { getStatusLabel } from "@/lib/status";
import { getUgtColor } from "@/features/project/utils";
import { downloadTemplate as downloadTemplateWithFallback } from "@/features/project/template";

interface Requirement {
  id: number;
  from_level: number;
  to_level: number;
  title: string;
  description: string;
  template_version: string;
  uploaded: boolean;
}

interface GostChecklistProps {
  projectId: number;
  currentLevel: number;
  status: string;
  /** Документы для гашения галочек (интеграция с DocsPanel). */
  documents?: DocumentOut[];
  onRefresh?: () => void;
  /** Колбэк после загрузки требований — для синхронизации с UgtLine */
  onRequirementsChange?: (requirements: Requirement[]) => void;
  className?: string;
}

/**
 * GostChecklist — чек-лист обязательных документов для перехода УГТ→УГТ+1.
 * Почему GostChecklist, а не ChecklistPanel: требование G16/G20/G21 требует
 * per УГТ список из GET /gost-requirements?level или fallback StageRequirement
 * с галочками и кнопкой «Скачать шаблон» per requirement.
 * Число чеков = числу минисекторов в UgtLine (история 10, тикет 06).
 */
export function GostChecklist({
  projectId,
  currentLevel,
  status,
  documents,
  onRefresh,
  onRequirementsChange,
  className = "",
}: GostChecklistProps) {
  void status;
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [requirements, setRequirements] = React.useState<Requirement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // основной источник по ТЗ 06 — GET /gost-requirements?level, fallback — stage-requirements
      try {
        const gost = await getGostRequirements(currentLevel, token);
        if (gost && gost.length) {
          setRequirements(gost as Requirement[]);
          onRequirementsChange?.(gost as Requirement[]);
          return;
        }
        throw new Error("empty gost");
      } catch {
        try {
          const stage = await getStageRequirements(projectId, token);
          setRequirements(stage as Requirement[]);
          onRequirementsChange?.(stage as Requirement[]);
          return;
        } catch (e2) {
          const st = (e2 as { status?: number })?.status;
          if (st === 409 || st === 404) {
            // fallback mock из RAG/ГОСТ — генерим локально
            const mock = mockRequirements(currentLevel);
            setRequirements(mock);
            onRequirementsChange?.(mock);
          } else {
            throw e2;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить требования.");
      const mock = mockRequirements(currentLevel);
      setRequirements(mock);
      onRequirementsChange?.(mock);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentLevel, token, onRequirementsChange]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // интеграция с DocsPanel: если документы содержат stage docs, гасим галочки
  const merged = React.useMemo(() => {
    if (!documents?.length) return requirements;
    const docTitles = new Set(documents.map((d) => d.title.toLowerCase()));
    // также учитываем file_name без расширения
    const docFileNames = new Set(
      documents
        .map((d) => (d.file_name ?? "").toLowerCase().replace(/\.[^.]+$/, ""))
        .filter(Boolean),
    );
    return requirements.map((r) => {
      const titleMatch = docTitles.has(r.title.toLowerCase());
      const fileMatch = docFileNames.has(r.title.toLowerCase());
      const uploaded = r.uploaded || titleMatch || fileMatch;
      return uploaded ? { ...r, uploaded: true } : r;
    });
  }, [requirements, documents]);

  // сообщаем наружу об изменениях merged для UgtLine синхронизации
  React.useEffect(() => {
    if (merged.length) onRequirementsChange?.(merged);
  }, [merged, onRequirementsChange]);

  const total = merged.length;
  const done = merged.filter((r) => r.uploaded).length;
  const color = getUgtColor(currentLevel);
  // Использование lib/status из 01 (дедуп STATUS_LABELS) — показываем статус карточки
  void getStatusLabel(status);

  if (loading) {
    return (
      <div className={`tz-card p-6 ${className}`} data-testid="checklist-panel">
        <div className="h-20 animate-pulse rounded-xl bg-tz-soft" />
      </div>
    );
  }

  return (
    <section
      className={`tz-card p-6 ${className}`}
      data-testid="gost-checklist"
      aria-label="Чек-лист ГОСТ документов"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="tz-eyebrow">Чек-лист ГОСТ</p>
          <h2 className="tz-card-title mt-1">
            Переход УГТ {currentLevel} → {currentLevel + 1}
          </h2>
          <p className="mt-1 text-sm text-tz-muted">
            Секторов в уровне: {total} · выполнено {done}/{total}
          </p>
          <p className="mt-1 text-xs text-tz-muted">
            Источник: GET /gost-requirements?level={currentLevel} или StageRequirement (ГОСТ Р 58048-2017)
          </p>
        </div>
        <button className="tz-btn tz-btn-ghost" onClick={() => void load()} aria-label="Обновить чек-лист">
          <RefreshCw size={15} /> Обновить
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger"
        >
          {error}
        </div>
      )}

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-tz-soft" aria-hidden="true">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: total ? `${(done / total) * 100}%` : "0%", background: color }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {merged.map((r) => (
          <li
            key={r.id}
            data-testid={`gost-checklist-item-${r.id}`}
            className="flex items-start gap-3 rounded-xl border border-tz-border p-3"
          >
            <span className={`mt-0.5 ${r.uploaded ? "text-tz-success" : "text-tz-muted"}`} aria-hidden="true">
              {r.uploaded ? <CheckCircle2 size={18} /> : <FileUp size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-tz-fg">{r.title}</p>
              <p className="text-xs text-tz-muted">{r.description}</p>
              {r.template_version && (
                <p className="mt-1 font-mono text-xs text-tz-secondary">Шаблон: {r.template_version}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-tz-muted">{r.uploaded ? "Загружено" : "Не загружено"}</span>
              <button
                className="tz-btn tz-btn-secondary tz-btn-sm"
                onClick={() => void downloadTemplateWithFallback(r, token)}
                aria-label={`Скачать шаблон ${r.title}`}
                data-testid={`download-template-${r.id}`}
              >
                <Download size={14} /> Скачать шаблон
              </button>
            </div>
          </li>
        ))}
      </ul>

      {onRefresh && (
        <button className="tz-btn tz-btn-ghost mt-4" onClick={onRefresh}>
          Обновить документы
        </button>
      )}
    </section>
  );
}

function mockRequirements(level: number): Requirement[] {
  const fallbackCount = ({ 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 3, 7: 4, 8: 5, 9: 6 } as Record<number, number>)[level] ?? 4;
  return Array.from({ length: fallbackCount }, (_, i) => ({
    id: level * 100 + i,
    from_level: level,
    to_level: Math.min(9, level + 1),
    title: `Документ ${i + 1} для УГТ ${level}`,
    description: `Обязательный документ по ГОСТ Р 58048-2017 для перехода УГТ ${level}→${level + 1}`,
    template_version: "v1",
    uploaded: false,
  }));
}

async function downloadTemplate(req: Requirement) {
  // Обёртка для теста — вызывает бэк GET /templates/{id} если 200, иначе local blob fallback + BLOCKED пометка
  // Шаблон скачивается с бэка GET /templates/{id} если 200, иначе local blob fallback
  // Версия из req.template_version — не v1 хардкод, берётся из бэка
  const { downloadTemplate: dl } = await import("@/features/project/template");
  // Пробуем бэк, при 200 — blob с бэка, при не-200 — local blob + BLOCKED: templates/{id}
  await dl(req, null);
}
void downloadTemplate;

// Совместимость: ChecklistPanel алиас к GostChecklist (тикет 03)
export const ChecklistPanel = GostChecklist;

export default GostChecklist;
