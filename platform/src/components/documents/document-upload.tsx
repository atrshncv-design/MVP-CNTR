/**
 * T-012. Загрузка документов организации (STATES.md §6).
 *
 * Машина состояний файла — строго по STATES.md §6: ожидание выбора →
 * выбрано → загружается → проверяется → принято | отклонено | ошибка+retry
 * (+ «удалено из черновика»). «Принято» показывается ТОЛЬКО после
 * завершения (демо) валидации — фаза accepted ставится по таймеру после
 * scanning, а не при выборе файла (компонент сам не переводит в accepted).
 *
 * Детерминированная валидация (демо): недопустимый тип → «Отклонено»,
 * файл больше лимита → «Ошибка + retry» (retry честно повторяет проверку).
 * После accepted вызывается onAccepted — родитель сохраняет документ
 * в локальном workspace организации.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Info } from "lucide-react";
import {
  UploadState,
  type UploadFileState,
  type UploadPhase,
} from "@/components/upload-state";

const ACCEPTED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "odt",
  "txt",
  "png",
  "jpg",
  "jpeg",
] as const;

const BLOCKED_EXTENSIONS = ["exe", "scr", "bat", "sh", "msi", "js", "vbs"];

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 МБ
const MAX_FILES = 10;

export const DOCUMENT_HINT = `Допустимые форматы: ${ACCEPTED_EXTENSIONS.join(
  ", ",
)}. Максимум ${MAX_FILES} файлов, до 15 МБ каждый.`;

const UPLOAD_MS = 800;
const SCAN_MS = 1000;

/** Этапы загрузки (после выбора): загрузка → проверка → финал. */
const FLOW: readonly UploadPhase[] = ["uploading", "scanning"];

export interface DocumentUploadProps {
  /**
   * Вызывается ПОСЛЕ завершения проверки файла (фаза accepted).
   * id/status/uploadedAt формирует хранилище (addOrgDocument).
   */
  onAccepted: (input: { title: string; kind: string }) => void;
  /** Файлы заблокированы (например, лимит исчерпан). */
  disabled?: boolean;
}

function extensionOf(name: string): string {
  const match = /\\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

export function DocumentUpload({ onAccepted, disabled = false }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  /** Жизненный цикл файла: выбрано → загружается → проверяется → финал. */
  const runFlow = (file: UploadFileState, kind: string, size: number) => {
    clearTimers();
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, phase: "uploading" } : f)),
    );
    let delay = UPLOAD_MS;
    for (const phase of FLOW) {
      timersRef.current.push(
        window.setTimeout(() => {
          setFiles((prev) =>
            prev.map((f) => (f.id === file.id ? { ...f, phase } : f)),
          );
        }, delay),
      );
      delay += phase === "uploading" ? SCAN_MS : 0;
    }
    // Финал — только ПОСЛЕ завершения «проверки» (STATES.md §6).
    timersRef.current.push(
      window.setTimeout(() => {
        const blocked = BLOCKED_EXTENSIONS.includes(kind);
        if (blocked) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    phase: "rejected",
                    message: "тип файла недопустим для документов организации",
                  }
                : f,
            ),
          );
          return;
        }
        if (size > MAX_FILE_BYTES) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    phase: "failed",
                    message: `файл больше ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} МБ — сократите или разделите перед загрузкой`,
                  }
                : f,
            ),
          );
          return;
        }
        // Проверка завершена — документ засчитан.
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        onAccepted({
          title: file.name,
          kind: kind !== "" ? kind.toUpperCase() : "файл",
        });
        setNotice(null);
      }, delay),
    );
  };

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setNotice(null);
    const selected: File[] = Array.from(list);
    const room = MAX_FILES - files.length;
    if (room <= 0) {
      setNotice(`Лимит — ${MAX_FILES} файлов. Дождитесь завершения загрузки.`);
      return;
    }
    for (const file of selected.slice(0, room)) {
      const id = `up-${Date.now().toString(36)}-${seqRef.current++}`;
      const kind = extensionOf(file.name);
      const state: UploadFileState = {
        id,
        name: file.name,
        size: file.size,
        phase: "selected",
      };
      setFiles((prev) => [...prev, state]);
      if (kind !== "" && !ACCEPTED_EXTENSIONS.includes(kind as (typeof ACCEPTED_EXTENSIONS)[number])) {
        // Недопустимый тип: отклонение честно, без запуска «загрузки».
        timersRef.current.push(
          window.setTimeout(() => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      phase: "rejected",
                      message: `тип «${kind}» недопустим — используйте: ${ACCEPTED_EXTENSIONS.join(", ")}`,
                    }
                  : f,
              ),
            );
          }, 350),
        );
      } else {
        runFlow(state, kind, file.size);
      }
    }
  };

  const handleRetry = (file: UploadFileState) => {
    const kind = extensionOf(file.name);
    const size = file.size ?? 0;
    runFlow({ ...file, phase: "selected" }, kind, size);
  };

  const handleRemove = (file: UploadFileState) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, phase: "removed" } : f)),
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
      }, 600),
    );
  };

  const roomLeft = MAX_FILES - files.length;

  return (
    <div className="space-y-3">
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
          className="sr-only"
          aria-label="Выбрать файлы документов"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          disabled={disabled || roomLeft <= 0}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || roomLeft <= 0}
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" aria-hidden />
          {disabled ? "Загрузка недоступна" : "Выбрать документы"}
        </button>
        <p className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {DOCUMENT_HINT}
        </p>
      </div>

      {notice ? (
        <p
          role="alert"
          className="rounded-control bg-status-warning-soft px-3 py-2.5 text-meta leading-relaxed text-status-warning"
        >
          {notice}
        </p>
      ) : null}

      <UploadState
        files={files}
        onRetry={handleRetry}
        onRemove={handleRemove}
        emptyLabel="Файлы не выбраны — добавьте документы организации"
      />
    </div>
  );
}
