"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { Download, FileText, FileUp, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { CLIENT_API_BASE } from "@/lib/public-api";
import { downloadFile } from "@/lib/api-client";

interface ProjectFile {
  id: number;
  title: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  scan_status: string;
  version: number;
  created_at: string | null;
}

const ALLOWED_TYPES = ["PDF", "DOCX", "XLSX", "JPG", "PNG"] as const;
const ACCEPT = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";
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
  if (file.size > MAX_MB * 1024 * 1024) return `Файл превышает ${MAX_MB} МБ`;
  return null;
}

/**
 * DocsPanel — унифицированная панель документов (заменяет 3 блока).
 * Почему один блок: интервью 4.4 требует унифицировать дубли.
 * Только скачать via GET /files/{id}/download, типы PDF/DOCX/XLSX/JPG/PNG 25МБ, ClamAV 409/413.
 */
export function DocsPanel({ projectId, onUploaded }: { projectId: number; onUploaded?: () => void }) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [files, setFiles] = React.useState<ProjectFile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProjectFile[];
      setFiles(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файлы");
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    const validation = isAllowedFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    if (!token) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail =
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : null;
        if (res.status === 413) throw new Error(detail ?? `Превышен лимит ${MAX_MB} МБ (413)`);
        if (res.status === 409) throw new Error(detail ?? "Антивирусная проверка не пройдена — скачивание недоступно (409)");
        throw new Error(detail ?? `Ошибка загрузки (${res.status})`);
      }
      const uploaded = (await res.json()) as ProjectFile;
      setNotice(
        uploaded.scan_status === "clean"
          ? `Файл «${uploaded.file_name}» проверен и принят`
          : `Файл «${uploaded.file_name}» загружен, статус: ${uploaded.scan_status}`,
      );
      await load();
      onUploaded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки файла";
      // обработка ClamAV 409/413 уже выше
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (fileId: number, fileName: string | null) => {
    if (!token) return;
    try {
      // только скачать via GET /files/{id}/download (G39)
      const blob = await downloadFile(fileId, token);
      // также прямой fallback через fetch для совместимости
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? "document";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка скачивания";
      if (msg.includes("409")) setError("Антивирусная проверка не пройдена — скачивание недоступно (409)");
      else if (msg.includes("413")) setError(`Превышен лимит ${MAX_MB} МБ (413)`);
      else setError(msg);
    }
  };

  return (
    <section className="tz-card p-6" data-testid="docs-panel" aria-label="Документы проекта">
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
        Унифицированная панель — все документы проекта. Типы: {ALLOWED_TYPES.join(", ")} до {MAX_MB} МБ. Только скачать (G39), превью запрещено.
      </p>
      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-3 rounded-xl border border-tz-success bg-tz-success-soft px-4 py-3 text-sm text-tz-success">
          {notice}
        </div>
      )}

      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="tz-btn tz-btn-primary" aria-label="Загрузить документ">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          {uploading ? "Загрузка…" : "Загрузить документ"}
        </button>
        <p className="mt-2 text-xs text-tz-muted">PDF, DOCX, XLSX, JPG, PNG до 25 МБ. Проверка ClamAV — 409/413 обрабатываются.</p>
      </div>

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded bg-tz-soft" />
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-tz-secondary">Файлов пока нет. Загрузите первый документ.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {files.map((file) => {
            const scan = SCAN_LABELS[file.scan_status] ?? SCAN_LABELS.pending;
            const canDownload = file.scan_status === "clean";
            return (
              <li
                key={file.id}
                data-testid={`doc-${file.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-tz-fg">{file.file_name ?? file.title}</p>
                  <p className="font-mono text-xs text-tz-muted">
                    v{file.version} · {formatSize(file.file_size)} · {file.mime_type ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {file.scan_status === "clean" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-tz-success">
                      <ShieldCheck size={13} /> проверен
                    </span>
                  ) : (
                    <span className={`tz-badge ${scan.cls}`}>
                      <ShieldAlert size={12} className="mr-1 inline" />
                      {scan.label}
                    </span>
                  )}
                  <button
                    onClick={() => void handleDownload(file.id, file.file_name ?? file.title)}
                    className="tz-btn tz-btn-ghost tz-btn-sm"
                    aria-label={`Скачать ${file.file_name ?? file.title}`}
                    disabled={!canDownload}
                    title={canDownload ? "Скачать через GET /files/{id}/download" : "Скачивание доступно только после clean-проверки"}
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
