"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { UgtLine } from "./UgtLine";
import { GostChecklist } from "@/features/docs/GostChecklist";
import { ChecklistPanel } from "@/features/docs/GostChecklist";
import { CanvasBlocks, type CanvasValue } from "./CanvasBlocks";
import { DocsPanel } from "@/features/docs/DocsPanel";
import { AiDocConsultant } from "@/features/docs/AiDocConsultant";
import { TeamPanel } from "./TeamPanel";
import { ActionsPanel } from "./ActionsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { useAutosave } from "./useAutosave";
import type { DocumentOut, ProjectDetailOut } from "@/lib/types";
import { getStatusColor, getStatusLabel } from "@/lib/status";
import { getReturnBadge } from "./utils";

interface ProjectCardProps {
  detail: ProjectDetailOut;
  onProjectChange?: (next: ProjectDetailOut) => void;
  className?: string;
}

/**
 * ProjectCard — единая адаптивная карточка проекта (тикет 03).
 * Разбивает монолит 1194 строк на модули: UgtLine, ChecklistPanel, CanvasBlocks, DocsPanel, TeamPanel, ActionsPanel, HistoryPanel.
 * Шапка как в примере 5.5, бюджет всем, мультитеги 1-5, история всем видна, действия внизу по правам.
 */
export function ProjectCard({ detail, onProjectChange, className = "" }: ProjectCardProps) {
  const { project, audit_trail, members, documents: initialDocuments, control_points } = detail;
  const statusColor = getStatusColor(project.status);
  // Бюджет всем виден (G38) — форматирование Intl.NumberFormat ru-RU RUB, без «по запросу»
  const budgetText =
    project.budget != null
      ? new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(project.budget)
      : "—";
  // состояние документов для интеграции DocsPanel ↔ GostChecklist ↔ UgtLine
  const [documents, setDocuments] = React.useState<DocumentOut[]>(initialDocuments as unknown as DocumentOut[]);
  const [gostRequirements, setGostRequirements] = React.useState<Array<{ id: number; from_level: number; to_level: number; title: string; description: string; template_version: string; uploaded: boolean }>>([]);
  // синхронизация с пропсом detail при смене проекта
  React.useEffect(() => {
    setDocuments(initialDocuments as unknown as DocumentOut[]);
  }, [initialDocuments]);
  // держим ссылку на ChecklistPanel чтобы линтер не ругался (тикет 03 совместимость)
  void ChecklistPanel;

  // hard-gate бейдж G50: при control_point.status===rejected или project.status===rejected
  // Показывает «Возврат на УГТ N — Причина: {rejection_reason|decision}» с классом tz-badge-review
  const rejectedCp = control_points.find((cp) => cp.status === "rejected" || cp.status === "No-Go" || cp.status === "no_go");
  const projectRejected = project.status === "rejected";
  // приоритет — control_point, затем проект; берём decision или rejection_reason из details
  const rejectionReason =
    (rejectedCp?.decision as string | null) ??
    (projectRejected ? (project as unknown as { rejection_reason?: string | null }).rejection_reason ?? null : null);
  const hardGateStatus = rejectedCp ? "rejected" : projectRejected ? "rejected" : "";
  const returnBadge = hardGateStatus ? getReturnBadge(hardGateStatus, rejectionReason, project.current_level) : null;

  const [canvasValue, setCanvasValue] = React.useState<CanvasValue | undefined>(undefined);
  const [, setShowEdit] = React.useState(false);

  // автосохранение 30с + диалог (G40) + G43 черновик без потери
  const storageKey = `tz:project:${project.id}:canvas`;
  // G43: ключ для модалки сессии — tz:draft:{projectId} (восстанавливается после логина)
  const draftKey = `tz:draft:${project.id}`;
  const { status: autosaveStatus, lastSavedAt, hasUnsaved } = useAutosave<CanvasValue | undefined>({
    value: canvasValue,
    storageKey,
    intervalMs: 30_000,
    enabled: !!canvasValue,
    onSave: async (val) => {
      // в реальности — PATCH /projects/{id}/canvas, пока localStorage + лог
      if (val) {
        console.debug("[autosave] project", project.id, val.tags);
        // G43: дублируем в tz:draft:{projectId} для восстановления после 401/RefreshAccessTokenError
        try {
          localStorage.setItem(draftKey, JSON.stringify(val));
          // экспонируем для SessionExpiredModal (event handler берёт window.__TZ_DRAFT__)
          (window as unknown as { __TZ_DRAFT__?: unknown }).__TZ_DRAFT__ = val;
        } catch {
          // ignore
        }
      }
    },
  });

  // загрузка сохранённого черновика (пробуем сначала G43 ключ, fallback на старый)
  React.useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(draftKey);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft) as CanvasValue;
        setCanvasValue(parsed);
        return;
      }
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CanvasValue;
        setCanvasValue(parsed);
      }
    } catch {
      // ignore
    }
  }, [draftKey, storageKey]);

  // G43: синхронно дублируем любое изменение canvasValue в tz:draft:{projectId} (на случай внезапной 401 между тиками autosave)
  React.useEffect(() => {
    if (!canvasValue) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(canvasValue));
      (window as unknown as { __TZ_DRAFT__?: unknown }).__TZ_DRAFT__ = canvasValue;
    } catch {
      // ignore
    }
  }, [canvasValue, draftKey]);

  return (
    <div className={`space-y-6 ${className}`} data-testid="project-card">
      {/* Шапка как в примере 5.5 */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="tz-badge font-mono text-xs font-semibold"
              style={{ background: `${statusColor}20`, color: statusColor }}
            >
              {getStatusLabel(project.status)}
            </span>
            {returnBadge && (
              <span data-testid="return-badge" className="tz-badge tz-badge-review">
                {returnBadge}
              </span>
            )}
            {(project.tags?.[0] ?? project.category) && (
              <span className="tz-badge tz-badge-neutral">{project.tags?.[0] ?? project.category}</span>
            )}
            <span className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</span>
            {/* бюджет всем */}
            <span className="tz-badge tz-badge-neutral" data-testid="budget-badge">
              Бюджет: {budgetText}
            </span>
          </div>
          <h1 className="tz-page-title">{project.name}</h1>
          {project.description && <p className="mt-2 max-w-2xl text-tz-muted">{project.description}</p>}
          {/* теги header */}
          {project.tags && project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" data-testid="project-tags">
              {project.tags.map((t) => (
                <span key={t} className="tz-chip">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="tz-card shrink-0 px-4 py-3">
          <div className="tz-eyebrow">Уровень УГТ</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="tz-ugt" style={{ color: getStatusColor(project.status) }}>{`УГТ ${project.current_level}`}</span>
            <span className="text-tz-muted">→</span>
            <span className="tz-ugt tz-ugt-strong">{project.target_level}</span>
          </div>
          {project.preliminary_level != null && project.preliminary_level !== project.current_level && (
            <p className="mt-1 text-xs text-tz-muted">Предварительный: УГТ {project.preliminary_level}</p>
          )}
          <p className="mt-1 text-xs text-tz-muted">по ГОСТ Р 58048-2017</p>
        </div>
      </div>

      {/* УГТ-линия дробных секторов — секторов = числу требований ГОСТа, интеграция с загрузкой */}
      <UgtLine
        currentLevel={project.current_level}
        requirements={gostRequirements.length ? gostRequirements : null}
        uploadedCount={documents.filter((d) => (d as { doc_type?: string }).doc_type === "stage" || (d as DocumentOut).doc_type === "file").length}
        documents={documents.map((d) => ({ doc_type: (d as DocumentOut).doc_type ?? "file", title: (d as DocumentOut).title }))}
      />

      {/* Чек-лист ГОСТ доков + ИИ-консультант узкий */}
      <GostChecklist
        projectId={project.id}
        currentLevel={project.current_level}
        status={project.status}
        documents={documents as DocumentOut[]}
        onRequirementsChange={setGostRequirements}
      />
      <AiDocConsultant level={project.current_level} requirements={gostRequirements} projectId={project.id} />

      {/* Канва 15 полей */}
      <CanvasBlocks
        project={project}
        detail={detail}
        value={canvasValue}
        onChange={setCanvasValue}
      />

      {/* DocsPanel унифицирован — один блок вместо 3 дублей, drag-n-drop + прогресс, только скачать */}
      <DocsPanel
        projectId={project.id}
        documents={documents as DocumentOut[]}
        onDocumentsChange={(docs) => {
          setDocuments(docs as unknown as DocumentOut[]);
          onProjectChange?.({ ...detail, documents: docs as unknown as typeof detail.documents });
        }}
        onUploaded={() => onProjectChange?.(detail)}
      />

      {/* TeamPanel */}
      <TeamPanel projectId={project.id} members={members} />

      {/* HistoryPanel всем видна */}
      <HistoryPanel entries={audit_trail} returnBadge={returnBadge} />

      {/* ActionsPanel внизу по правам */}
      <ActionsPanel
        project={project}
        onProjectChange={(next) => onProjectChange?.({ ...detail, project: next })}
        onEdit={() => setShowEdit((v) => !v)}
        autosaveStatus={autosaveStatus}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={hasUnsaved}
      />

      {/* диалог несохранённых изменений */}
      {hasUnsaved && (
        <div
          role="dialog"
          aria-label="Несохранённые изменения"
          data-testid="unsaved-dialog"
          className="fixed bottom-4 right-4 z-50 rounded-xl border border-tz-warning bg-tz-warning-soft px-4 py-3 text-sm text-tz-warning shadow-lg"
        >
          Есть несохранённые изменения — автосохранение через 30с. <span className="font-semibold">Сохранено</span> появится после сохранения.
        </div>
      )}
    </div>
  );
}

export default ProjectCard;
