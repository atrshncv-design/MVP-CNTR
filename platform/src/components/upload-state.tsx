/**
 * T-005. Состояния загрузки документа (STATES.md §6).
 *
 * Машина состояний файла: ожидание выбора → выбрано → загружается →
 * проверяется (формат/безопасность) → принято | отклонено | ошибка+retry,
 * плюс «удалено из черновика» и «отправлено и зафиксировано».
 *
 * КЛЮЧЕВОЕ ПРАВИЛО (STATES.md §6): «Принято» показывается ТОЛЬКО после
 * завершения валидации (mock или бэкенд). Компонент не переходит в accepted
 * сам — вызывающий код переводит фазу по факту завершения проверки.
 *
 * Переходы фазы — обязанность вызывающего кода; здесь только отображение
 * и действия retry/remove для соответствующих фаз.
 */

"use client";

import {
  AlertTriangle,
  FileCheck,
  FileUp,
  FileX,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { TONE_TEXT, type StatusTone } from "@/lib/status";

/** Фаза загрузки файла (STATES.md §6, порядок жизненного цикла). */
export type UploadPhase =
  | "idle" // ожидание выбора
  | "selected" // выбрано
  | "uploading" // загружается
  | "scanning" // загружено, проверяется
  | "accepted" // принято (только после завершения валидации)
  | "rejected" // отклонено по формату/безопасности
  | "failed" // ошибка + retry
  | "removed" // удалено из черновика
  | "submitted"; // отправлено и зафиксировано

export interface UploadPhaseMeta {
  phase: UploadPhase;
  label: string;
  description: string;
  tone: StatusTone;
  icon: LucideIcon;
  /** Индикатор прогресса: "none" | "indeterminate" | процент (0–100). */
  progress: "none" | "indeterminate" | number;
}

export const UPLOAD_PHASE_META: Record<UploadPhase, UploadPhaseMeta> = {
  idle: {
    phase: "idle",
    label: "Файл не выбран",
    description: "Выберите файл для загрузки",
    tone: "draft",
    icon: FileUp,
    progress: "none",
  },
  selected: {
    phase: "selected",
    label: "Файл выбран",
    description: "Готов к загрузке",
    tone: "info",
    icon: FileUp,
    progress: "none",
  },
  uploading: {
    phase: "uploading",
    label: "Загружается",
    description: "Отправляем файл на сервер",
    tone: "info",
    icon: Loader2,
    progress: "indeterminate",
  },
  scanning: {
    phase: "scanning",
    label: "Проверяем файл",
    description: "Формат и безопасность проверяются",
    tone: "info",
    icon: ShieldCheck,
    progress: "indeterminate",
  },
  accepted: {
    phase: "accepted",
    label: "Принято",
    description: "Проверка завершена, файл засчитан",
    tone: "success",
    icon: FileCheck,
    progress: "none",
  },
  rejected: {
    phase: "rejected",
    label: "Отклонено",
    description: "Файл не прошёл проверку формата или безопасности",
    tone: "danger",
    icon: FileX,
    progress: "none",
  },
  failed: {
    phase: "failed",
    label: "Ошибка загрузки",
    description: "Не удалось загрузить файл",
    tone: "danger",
    icon: AlertTriangle,
    progress: "none",
  },
  removed: {
    phase: "removed",
    label: "Удалено из черновика",
    description: "Файл убран, черновик не изменён",
    tone: "draft",
    icon: Trash2,
    progress: "none",
  },
  submitted: {
    phase: "submitted",
    label: "Отправлено и зафиксировано",
    description: "Файл закреплён в заявке, изменение недоступно",
    tone: "success",
    icon: Lock,
    progress: "none",
  },
};

/** Состояние файла в загрузчике. */
export interface UploadFileState {
  id: string;
  name: string;
  /** Размер в байтах (если известен). */
  size?: number;
  phase: UploadPhase;
  /** Причина отклонения/ошибки — только если реально известна. */
  message?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export interface UploadStateProps {
  files: readonly UploadFileState[];
  /** Повторить загрузку для файла в фазе failed. */
  onRetry?: (file: UploadFileState) => void;
  /** Удалить файл из черновика (не для submitted — там изменение недоступно). */
  onRemove?: (file: UploadFileState) => void;
  /** Подпись пустого списка (фаза idle всего загрузчика). */
  emptyLabel?: string;
}

export function UploadState({
  files,
  onRetry,
  onRemove,
  emptyLabel = "Файлы не выбраны — добавьте документы для комплекта",
}: UploadStateProps) {
  if (files.length === 0) {
    return (
      <p className="rounded-panel border border-dashed border-subtle bg-surface px-4 py-6 text-center text-small text-secondary">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {files.map((file) => {
        const meta = UPLOAD_PHASE_META[file.phase];
        const Icon = meta.icon;
        const busy = file.phase === "uploading" || file.phase === "scanning";
        const canRemove =
          file.phase !== "submitted" &&
          file.phase !== "removed" &&
          file.phase !== "accepted";
        const showProgress =
          meta.progress !== "none" && (file.phase === "uploading" || file.phase === "scanning");
        const progressValue =
          typeof meta.progress === "number" ? meta.progress : undefined;

        return (
          <li
            key={file.id}
            className={`flex flex-wrap items-center gap-3 rounded-control border px-4 py-3 ${
              file.phase === "rejected" || file.phase === "failed"
                ? "border-status-danger/40 bg-status-danger-soft/40"
                : "border-subtle bg-surface"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                TONE_TEXT[meta.tone]
              } ${file.phase === "uploading" ? "bg-accent-soft" : "bg-canvas"}`}
              aria-hidden
            >
              <Icon
                className={`h-5 w-5 ${busy ? "animate-spin" : ""}`}
              />
            </span>

            <div className="min-w-0 flex-1 basis-48">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="truncate text-small font-medium text-primary">
                  {file.name}
                </p>
                {file.size ? (
                  <p className="font-mono text-meta text-muted">
                    {formatSize(file.size)}
                  </p>
                ) : null}
              </div>
              <p className={`text-meta ${TONE_TEXT[meta.tone]}`}>
                {meta.label}
                {file.message ? ` — ${file.message}` : ""}
              </p>
              {showProgress ? (
                <div
                  className="ugt-track mt-2"
                  role="progressbar"
                  aria-label={`Загрузка файла ${file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressValue}
                >
                  <div
                    className={`ugt-track-fill ${
                      meta.progress === "indeterminate"
                        ? "w-2/5 animate-pulse"
                        : ""
                    }`}
                    style={
                      meta.progress !== "indeterminate"
                        ? { width: `${meta.progress}%` }
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {file.phase === "failed" && onRetry ? (
                <button
                  type="button"
                  onClick={() => onRetry(file)}
                  className="inline-flex h-10 items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Повторить
                </button>
              ) : null}
              {canRemove && onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(file)}
                  aria-label={`Удалить файл ${file.name} из черновика`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-muted transition-colors hover:border-status-danger hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
