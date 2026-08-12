"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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

const SCAN_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "На проверке", cls: "tz-badge-review" },
  clean: { label: "Проверен", cls: "tz-badge-success" },
  infected: { label: "Заражён", cls: "tz-badge-danger" },
  error: { label: "Ошибка проверки", cls: "tz-badge-danger" },
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function ProjectFilesPanel({ projectId }: { projectId: number }) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/files`, {
        headers: auth(token),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFiles(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файлы");
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const upload = async (file: File) => {
    if (!token) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/files`, {
        method: "POST",
        headers: auth(token),
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : `Ошибка загрузки (${res.status})`;
        throw new Error(msg);
      }
      const uploaded = (await res.json()) as ProjectFile;
      setNotice(
        uploaded.scan_status === "clean"
          ? `Файл «${uploaded.file_name}» проверен и принят`
          : `Файл «${uploaded.file_name}» загружен, статус: ${uploaded.scan_status}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки файла");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const download = async (fileId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/files/${fileId}/download`, {
        headers: auth(token),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : `Ошибка скачивания (${res.status})`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "document";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания");
    }
  };

  return (
    <div className="tz-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileUp size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">Файлы проекта</h2>
        </div>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label="Обновить">
          <RefreshCw size={15} />
        </button>
      </div>
      <p className="mt-1 text-sm text-tz-muted">
        PDF, DOCX, XLSX, PNG, JPEG до 25 МБ. Файл учитывается после антивирусной проверки.
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger/30 bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-3 rounded-xl border border-tz-success/30 bg-tz-success-soft px-4 py-3 text-sm text-tz-success">
          {notice}
        </div>
      )}

      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="tz-btn tz-btn-primary"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          {uploading ? "Загрузка…" : "Загрузить документ"}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded bg-tz-soft" />
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-tz-secondary">Файлов пока нет.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {files.map((file) => {
            const scan = SCAN_LABELS[file.scan_status] ?? SCAN_LABELS.pending;
            return (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-2.5">
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
                    onClick={() => void download(file.id)}
                    className="tz-btn tz-btn-ghost"
                    aria-label={`Скачать ${file.file_name}`}
                    disabled={file.scan_status === "infected"}
                  >
                    <Download size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
