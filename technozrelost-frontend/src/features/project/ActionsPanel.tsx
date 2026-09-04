"use client";

import * as React from "react";
import { Archive, Download, Edit, Globe, Loader2, Share2, Upload, Copy, Check, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { archiveProject, exportProject, regenerateProjectToken, togglePublish } from "@/lib/api-client";
import type { ProjectCardOut } from "@/lib/types";
import { dateTimeLocale } from "./i18n";

interface ActionsPanelProps {
  project: ProjectCardOut;
  onProjectChange?: (next: ProjectCardOut) => void;
  onEdit?: () => void;
  onUpload?: () => void;
  className?: string;
  /** Автосохранение */
  autosaveStatus?: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: string | null;
  hasUnsavedChanges?: boolean;
}

/**
 * ActionsPanel — блок действий внизу по правам (G23).
 * Владелец/manager/admin — Редактировать/Опубликовать/Архивировать/Экспорт/Токен/Поделиться
 * Остальные — Загрузить документ + Поделиться
 * + beforeunload диалог, автосохранение 30с индикатор «Сохранено», токен, шаринг.
 */
export function ActionsPanel({
  project,
  onProjectChange,
  onEdit,
  onUpload,
  className = "",
  autosaveStatus = "idle",
  lastSavedAt,
  hasUnsavedChanges,
}: ActionsPanelProps) {
  const { data: session } = useSession();
  const t = useTranslations("project");
  const timeLocale = dateTimeLocale(useLocale());
  const token = session?.user?.accessToken;
  const userRoles: string[] = (session?.user?.roles as string[]) ?? [];
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const isOwner = project.created_by != null && project.created_by === userId;
  const isManager = userRoles.includes("cntr_manager") || userRoles.includes("cntr_admin");
  const isPrivileged = isOwner || isManager;

  const [publishing, setPublishing] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handlePublish = async () => {
    if (!token) return;
    setPublishing(true);
    setError(null);
    try {
      const updated = await togglePublish(project.id, !project.is_public, project.show_preliminary ?? false, token);
      onProjectChange?.({ ...project, is_public: updated.is_public });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errPublish"));
    } finally {
      setPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!token) return;
    setArchiving(true);
    setError(null);
    try {
      const updated = await archiveProject(project.id, token);
      onProjectChange?.({ ...project, status: updated.status as string });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errArchive"));
    } finally {
      setArchiving(false);
    }
  };

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportProject(project.id, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-${project.id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errExport"));
    } finally {
      setExporting(false);
    }
  };

  const copyToken = async () => {
    if (!project.join_token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${project.join_token}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("errCopy"));
    }
  };

  const regenerate = async () => {
    if (!token) return;
    setRegenerating(true);
    setError(null);
    try {
      const data = await regenerateProjectToken(project.id, token);
      onProjectChange?.({ ...project, join_token: data.join_token });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errToken"));
    } finally {
      setRegenerating(false);
    }
  };

  const handleShare = async () => {
    const url = project.join_token ? `${window.location.origin}/join/${project.join_token}` : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: project.name, url });
      } catch {
        // fallback copy
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      className={`tz-card p-6 ${className}`}
      data-testid="actions-panel"
      aria-label={t("actionsAria")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="tz-card-title">{t("actionsTitle")}</h2>
        {/* Автосохранение индикатор 30с */}
        <div className="flex items-center gap-2 text-sm" aria-live="polite" data-testid="autosave-indicator">
          {autosaveStatus === "saving" && (
            <>
              <Loader2 size={14} className="animate-spin text-tz-muted" /> <span className="text-tz-muted">{t("autosaveSaving")}</span>
            </>
          )}
          {autosaveStatus === "saved" && (
            <>
              <Check size={14} className="text-tz-success" /> <span className="text-tz-success">{t("autosaveSaved")}</span>
              {lastSavedAt && <span className="text-xs text-tz-muted">{new Date(lastSavedAt).toLocaleTimeString(timeLocale)}</span>}
            </>
          )}
          {autosaveStatus === "error" && <span className="text-tz-danger">{t("autosaveError")}</span>}
          {hasUnsavedChanges && autosaveStatus !== "saving" && <span className="text-xs text-tz-warning">{t("autosaveUnsaved")}</span>}
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          {error}
        </div>
      )}

      {isPrivileged ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="tz-btn tz-btn-primary" onClick={onEdit} aria-label={t("editAria")}>
            <Edit size={15} /> {t("editBtn")}
          </button>
          <button
            className={`tz-btn ${project.is_public ? "tz-btn-secondary" : "tz-btn-primary"}`}
            onClick={() => void handlePublish()}
            disabled={publishing}
            aria-label={project.is_public ? t("unpublishBtn") : t("publishBtn")}
          >
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
            {project.is_public ? t("unpublishBtn") : t("publishBtn")}
          </button>
          {project.status !== "archived" ? (
            <button className="tz-btn tz-btn-ghost" onClick={() => void handleArchive()} disabled={archiving} aria-label={t("archiveBtn")}>
              {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} {t("archiveBtn")}
            </button>
          ) : (
            <span className="tz-btn tz-btn-ghost opacity-60">{t("archivedBadge")}</span>
          )}
          <button className="tz-btn tz-btn-ghost" onClick={() => void handleExport()} disabled={exporting} aria-label={t("exportBtn")}>
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {t("exportBtn")}
          </button>
          <button className="tz-btn tz-btn-ghost" onClick={() => void copyToken()} aria-label={t("copyTokenAria")}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {project.join_token ? project.join_token : t("tokenFallback")}
          </button>
          <button className="tz-btn tz-btn-ghost" onClick={() => void regenerate()} disabled={regenerating} aria-label={t("refreshTokenAria")}>
            {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("tokenBtn")}
          </button>
          <button className="tz-btn tz-btn-ghost" onClick={() => void handleShare()} aria-label={t("shareBtn")}>
            <Share2 size={14} /> {t("shareBtn")}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="tz-btn tz-btn-primary" onClick={onUpload ?? onEdit} aria-label={t("uploadBtn")}>
            <Upload size={15} /> {t("uploadBtn")}
          </button>
          <button className="tz-btn tz-btn-ghost" onClick={() => void handleShare()} aria-label={t("shareAria")}>
            <Share2 size={14} /> {t("shareBtn")}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-tz-muted">
        {t("actionsFootnote", { token: project.join_token ?? "—" })}
      </p>
    </section>
  );
}

export default ActionsPanel;
