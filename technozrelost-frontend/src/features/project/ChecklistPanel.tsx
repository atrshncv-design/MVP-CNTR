"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { CheckCircle2, Download, FileUp, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { getGostRequirements, getStageRequirements } from "@/lib/api-client";
import { asTranslateFn, type TranslateFn } from "@/lib/types";
import { getUgtColor } from "./utils";
import type { DocumentOut } from "@/lib/types";
import { downloadTemplate as downloadTemplateWithFallback } from "./template";

interface Requirement {
  id: number;
  from_level: number;
  to_level: number;
  title: string;
  description: string;
  template_version: string;
  uploaded: boolean;
}

interface ChecklistPanelProps {
  projectId: number;
  currentLevel: number;
  status: string;
  /** Документы для гашения галочек (интеграция с DocsPanel). */
  documents?: DocumentOut[];
  onRefresh?: () => void;
  className?: string;
}

/**
 * ChecklistPanel — чек-лист обязательных доков для перехода current→next.
 * Почему отдельно: G20 требует список StageRequirement.from_level→to_level с галочками
 * и кнопкой «Скачать шаблон» per requirement, интеграция с DocsPanel (загруженный док гасит галочку).
 */
export function ChecklistPanel({
  projectId,
  currentLevel,
  status,
  documents,
  onRefresh,
  className = "",
}: ChecklistPanelProps) {
  void status;
  const { data: session } = useSession();
  const t = useTranslations("project");
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
    const tr = asTranslateFn(t);
    try {
      // основной источник — StageRequirement (GET /projects/{id}/stage-requirements)
      const data = await getStageRequirements(projectId, token);
      setRequirements(data as Requirement[]);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 409 || status === 404) {
        try {
          const gost = await getGostRequirements(currentLevel, token);
          setRequirements(gost as Requirement[]);
        } catch {
          setRequirements(mockRequirements(currentLevel, tr));
        }
      } else {
        setError(e instanceof Error ? e.message : t("errChecklist"));
        setRequirements(mockRequirements(currentLevel, tr));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, currentLevel, token, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // интеграция с DocsPanel: если документы уже содержат stage docs, считаем галочки
  // uploaded из requirements уже учитывает scan clean, но дополнительно сверяем по documents
  const merged = React.useMemo(() => {
    if (!documents?.length) return requirements;
    // эвристика: если документы есть, считаем что требование выполнено если title совпадает
    const docTitles = new Set(documents.map((d) => d.title.toLowerCase()));
    return requirements.map((r) =>
      docTitles.has(r.title.toLowerCase()) ? { ...r, uploaded: true } : r,
    );
  }, [requirements, documents]);

  const total = merged.length;
  const done = merged.filter((r) => r.uploaded).length;
  const color = getUgtColor(currentLevel);

  if (loading) {
    return (
      <div className={`tz-card p-6 ${className}`} data-testid="checklist-panel">
        <div className="h-20 animate-pulse rounded-xl bg-tz-soft" />
      </div>
    );
  }

  return (
    <section className={`tz-card p-6 ${className}`} data-testid="checklist-panel" aria-label={t("checklistAria")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="tz-eyebrow">{t("checklistEyebrow")}</p>
          <h2 className="tz-card-title mt-1">
            {t("checklistTitle", { from: currentLevel, to: currentLevel + 1 })}
          </h2>
          <p className="mt-1 text-sm text-tz-muted">
            {t("checklistProgress", { total, done })}
          </p>
        </div>
        <button className="tz-btn tz-btn-ghost" onClick={() => void load()} aria-label={t("refreshChecklist")}>
          <RefreshCw size={15} /> {t("refresh")}
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
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
            data-testid={`checklist-item-${r.id}`}
            className="flex items-start gap-3 rounded-xl border border-tz-border p-3"
          >
            <span className={`mt-0.5 ${r.uploaded ? "text-tz-success" : "text-tz-muted"}`} aria-hidden="true">
              {r.uploaded ? <CheckCircle2 size={18} /> : <FileUp size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-tz-fg">{r.title}</p>
              <p className="text-xs text-tz-muted">{r.description}</p>
              {r.template_version && (
                <p className="mt-1 font-mono text-xs text-tz-secondary">{t("templateVersion", { version: r.template_version })}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-tz-muted">{r.uploaded ? t("uploadedBadge") : t("notUploaded")}</span>
              <button
                className="tz-btn tz-btn-secondary tz-btn-sm"
                onClick={() => void downloadTemplateWithFallback(r, token)}
                aria-label={t("downloadTemplateAria", { title: r.title })}
                data-testid={`download-template-${r.id}`}
              >
                <Download size={14} /> {t("downloadTemplate")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {onRefresh && (
        <button className="tz-btn tz-btn-ghost mt-4" onClick={onRefresh}>
          {t("refreshDocs")}
        </button>
      )}
    </section>
  );
}

function mockRequirements(level: number, t: TranslateFn): Requirement[] {
  const fallbackCount = ({ 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 3, 7: 4, 8: 5, 9: 6 } as Record<number, number>)[level] ?? 4;
  return Array.from({ length: fallbackCount }, (_, i) => ({
    id: level * 100 + i,
    from_level: level,
    to_level: Math.min(9, level + 1),
    title: t("mockDocTitle", { index: i + 1, level }),
    description: t("mockDocDesc", { level, next: Math.min(9, level + 1) }),
    template_version: "v1",
    uploaded: false,
  }));
}

async function downloadTemplate(req: Requirement) {
  // Шаблон скачивается с бэка GET /templates/{id} если 200, иначе local blob fallback + BLOCKED пометка
  // Версия из req.template_version — не v1 хардкод
  const { downloadTemplate: dl } = await import("./template");
  await dl(req, null);
}
void downloadTemplate;

export default ChecklistPanel;
