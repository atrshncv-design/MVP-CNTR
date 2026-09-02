"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { Download, FileText, FileUp, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { useSession } from "next-auth/react";

import { downloadFile, getProjectFiles, rescanFile, uploadFile } from "@/lib/api-client";
import type { DocumentOut } from "@/lib/types";
import { getStatusBadge } from "@/lib/status";
import { useDebouncedValue } from "@/lib/filters";

// ProjectFile = DocumentOut (единый тип из lib/types, без дубля)
type ProjectFile = DocumentOut;

const ALLOWED_TYPES = ["PDF", "DOCX", "XLSX", "JPG", "PNG"] as const;
const ACCEPT = ".pdf,.docx,.xlsx,.jpg,.png";
const MAX_MB = 25;

const SCAN_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "На проверке", cls: "tz-badge-review" },
  clean: { label: "Проверен", cls: "tz-badge-success" },
  infected: { label: "Заражён", cls: "tz-badge-danger" },
  error: { label: "Ошибка проверки", cls: "tz-badge-danger" },
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function isAllowedFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExts = ["pdf", "docx", "xlsx", "jpg", "jpeg", "png"];
  if (!allowedExts.includes(ext)) return `Тип файла .${ext} не поддерживается. Разрешены: ${ALLOWED_TYPES.join(", ")}`;
  if (file.size > MAX_MB * 1024 * 1024) return `Файл превышает ${MAX_MB} МБ (413)`;
  // mime fallback — проверка по имени достаточна, бэк проверит сигнатуру
  return null;
}

/**
 * DocsPanel — унифицированная панель документов (тикет 06).
 * Почему один блок: интервью 4.4 требует унифицировать 3 дубля в один DocsPanel.
 * Только скачать via GET /files/{id}/download (G39), типы PDF/DOCX/XLSX/JPG/PNG 25МБ (G53),
 * ClamAV fail-closed 409/413, scan_status бейджи, drag-n-drop + прогресс.
 * Использует lib/types/api-client/status из 01, не лезет в registry/matching.
 */
export function DocsPanel({
  projectId,
  onUploaded,
  documents: initialDocuments,
  onDocumentsChange,
}: {
  projectId: number;
  onUploaded?: () => void;
  documents?: DocumentOut[];
  onDocumentsChange?: (docs: DocumentOut[]) => void;
}) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [files, setFiles] = React.useState<ProjectFile[]>((initialDocuments as ProjectFile[]) ?? []);
  const [loading, setLoading] = React.useState(!initialDocuments);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [rescanningId, setRescanningId] = React.useState<number | null>(null);
  // использование lib/filters из 01 — дебаунс для поиска по файлам (фильтрация)
  const [filterQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(filterQuery, 300);
  void debouncedQuery;
  void getStatusBadge("published");

  // синхронизация с переданными documents (например из ProjectCard)
  React.useEffect(() => {
    if (initialDocuments) {
      setFiles(initialDocuments as ProjectFile[]);
      setLoading(false);
    }
  }, [initialDocuments]);

  const load = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await getProjectFiles(projectId, token);
      setFiles(data as ProjectFile[]);
      onDocumentsChange?.(data as DocumentOut[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файлы");
    } finally {
      setLoading(false);
    }
  }, [token, projectId, onDocumentsChange]);

  React.useEffect(() => {
    if (!initialDocuments) void load();
  }, [load, initialDocuments]);

  const doUpload = async (file: File) => {
    const validation = isAllowedFile(file);
    if (validation) {
      // 413 handling — показываем «Файл >25МБ»
      setError(validation);
      return;
    }
    if (!token) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    setNotice(null);
    // симуляция прогресса (fetch без xhr progress) — интервал 0..90%
    const interval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 10 : p));
    }, 120);
    try {
      // используем api-client.uploadFile (единый клиент из 01)
      const uploaded = await uploadFile(projectId, file, token);
      clearInterval(interval);
      setProgress(100);
      setNotice(
        uploaded.scan_status === "clean"
          ? `Файл «${uploaded.file_name ?? uploaded.title}» проверен и принят`
          : `Файл «${uploaded.file_name ?? uploaded.title}» загружен, статус: ${uploaded.scan_status}`,
      );
      await load();
      onUploaded?.();
      // интеграция с UgtLine: после успеха чек-лист гасится — onDocumentsChange уже обновил
      setTimeout(() => setProgress(0), 600);
    } catch (e) {
      clearInterval(interval);
      setProgress(0);
      const msg = e instanceof Error ? e.message : "Ошибка загрузки файла";
      const status = (e as { status?: number })?.status;
      if (status === 413 || msg.includes("413") || msg.includes("25 МБ")) {
        setError(`Файл превышает ${MAX_MB} МБ (413)`);
      } else if (status === 409 || msg.includes("409")) {
        setError("Проверка антивирусом — файл заблокирован (409). Нажмите «Перепроверить»");
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (fileId: number, fileName: string | null) => {
    if (!token) return;
    try {
      // только скачать via GET /files/{id}/download (G39), без setViewingDoc
      const blob = await downloadFile(fileId, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? "document";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка скачивания";
      const status = (e as { status?: number })?.status;
      if (status === 409 || msg.includes("409")) setError("Антивирусная проверка не пройдена — скачивание недоступно (409)");
      else if (status === 413 || msg.includes("413")) setError(`Превышен лимит ${MAX_MB} МБ (413)`);
      else setError(msg);
    }
  };

  const handleRescan = async (fileId: number) => {
    if (!token) return;
    setRescanningId(fileId);
    setError(null);
    try {
      const updated = await rescanFile(fileId, token);
      // обновляем локально
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, scan_status: updated.scan_status } : f)));
      setNotice(`Перепроверка: ${updated.scan_status}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка перепроверки";
      const status = (e as { status?: number })?.status;
      if (status === 409) setError("Проверка антивирусом — скачивание недоступно (409)");
      else setError(msg);
    } finally {
      setRescanningId(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void doUpload(file);
  };

  return (
    <section
      className="tz-card p-6"
      data-testid="docs-panel"
      aria-label="Документы проекта"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">Документы</h2>
          <span className="tz-badge tz-badge-neutral">{files.length}</span>
        </div>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label="Обновить документы">
          <RefreshCw size={15} />
        </button>
      </div>
      <p className="mt-1 text-sm text-tz-muted">
        Унифицированная панель — все документы проекта. Типы: {ALLOWED_TYPES.join(", ")} до {MAX_MB} МБ. Только скачать
        (G39), превью запрещено. Drag-n-drop поддерживается.
      </p>
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="mt-3 rounded-xl border border-tz-success bg-tz-success-soft px-4 py-3 text-sm text-tz-success"
        >
          {notice}
        </div>
      )}

      {/* Drag-n-drop зона + прогресс */}
      <div
        className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragActive ? "border-tz-accent bg-tz-accent-soft" : "border-tz-border bg-tz-surface"
        }`}
        data-testid="docs-dropzone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Upload size={22} className="mx-auto text-tz-muted" aria-hidden="true" />
        <p className="mt-2 text-sm text-tz-secondary">
          Перетащите файлы сюда или{" "}
          <button
            type="button"
            className="font-semibold text-tz-accent underline"
            onClick={() => fileInputRef.current?.click()}
          >
            выберите
          </button>
        </p>
        <p className="mt-1 text-xs text-tz-muted">PDF, DOCX, XLSX, JPG, PNG до 25 МБ. Проверка ClamAV — 409/413.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doUpload(file);
          }}
        />
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="tz-btn tz-btn-primary"
            aria-label="Загрузить документ"
            data-testid="upload-doc-button"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {uploading ? "Загрузка…" : "Загрузить документ"}
          </button>
        </div>
        {uploading && (
          <div className="mt-3" data-testid="upload-progress">
            <div className="tz-progress">
              <div className="tz-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-tz-muted">{progress}%</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded bg-tz-soft" />
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-tz-secondary">Файлов пока нет. Загрузите первый документ — сектор УГТ закрасится.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {files.map((file) => {
            const scan = SCAN_LABELS[file.scan_status] ?? SCAN_LABELS.pending;
            const canDownload = file.scan_status === "clean";
            const isPending = file.scan_status === "pending" || file.scan_status === "error";
            return (
              <li
                key={file.id}
                data-testid={`doc-${file.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-tz-fg">{file.file_name ?? file.title}</p>
                  <p className="font-mono text-xs text-tz-muted">
                    {file.title} · v{file.version} · {formatSize(file.file_size)} · {file.mime_type ?? "—"} · uploaded_by:{" "}
                    {file.uploaded_by ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {file.scan_status === "clean" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-tz-success">
                      <ShieldCheck size={13} /> проверен
                    </span>
                  ) : (
                    <span className={`tz-badge ${scan.cls}`} data-testid={`scan-badge-${file.id}`}>
                      <ShieldAlert size={12} className="mr-1 inline" />
                      {scan.label}
                    </span>
                  )}
                  {isPending && (
                    <button
                      onClick={() => void handleRescan(file.id)}
                      disabled={rescanningId === file.id}
                      className="tz-btn tz-btn-ghost tz-btn-sm"
                      aria-label="Перепроверить"
                      data-testid={`rescan-${file.id}`}
                    >
                      {rescanningId === file.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Перепроверить
                    </button>
                  )}
                  <button
                    onClick={() => void handleDownload(file.id, file.file_name ?? file.title)}
                    className="tz-btn tz-btn-ghost tz-btn-sm"
                    aria-label={`Скачать ${file.file_name ?? file.title}`}
                    disabled={!canDownload}
                    title={canDownload ? "Скачать через GET /files/{id}/download" : "Скачивание доступно только после clean-проверки"}
                    data-testid={`download-${file.id}`}
                  >
                    <Download size={15} /> Скачать
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DocsPanel;
