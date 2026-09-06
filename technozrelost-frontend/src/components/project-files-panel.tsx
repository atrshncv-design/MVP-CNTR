"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { CLIENT_API_BASE } from "@/lib/public-api";
import { SCAN_CLASSES, formatSizeT, getScanLabel } from "@/features/dashboard/i18n";


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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export default function ProjectFilesPanel({ projectId }: { projectId: number }) {
  const { data: session } = useSession();
  const t = useTranslations("dashboard");
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
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/files`, {
        headers: auth(token),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFiles(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("filesLoadError"));
    } finally {
      setLoading(false);
    }
  }, [token, projectId, t]);

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
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/files`, {
        method: "POST",
        headers: auth(token),
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : t("filesUploadErrorStatus", { status: res.status });
        throw new Error(msg);
      }
      const uploaded = (await res.json()) as ProjectFile;
      setNotice(
        uploaded.scan_status === "clean"
          ? t("filesUploadedClean", { name: uploaded.file_name ?? "" })
          : t("filesUploadedStatus", {
              name: uploaded.file_name ?? "",
              status: getScanLabel(t, uploaded.scan_status),
            }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("filesUploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const download = async (fileId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/files/${fileId}/download`, {
        headers: auth(token),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : t("filesDownloadErrorStatus", { status: res.status }),
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
      setError(e instanceof Error ? e.message : t("filesDownloadFailed"));
    }
  };

  return (
    <div className="tz-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileUp size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">{t("filesTitle")}</h2>
        </div>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label={t("filesRefresh")}>
          <RefreshCw size={15} />
        </button>
      </div>
      <p className="mt-1 text-sm text-tz-muted">
        {t("filesHint")}
      </p>

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger-fg">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-3 rounded-xl border border-tz-success-border bg-tz-success-soft px-4 py-3 text-sm text-tz-success-fg">
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
          {uploading ? t("filesUploading") : t("filesUpload")}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded bg-tz-soft" />
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-tz-secondary">{t("filesEmpty")}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {files.map((file) => {
            const scanCls = SCAN_CLASSES[file.scan_status] ?? SCAN_CLASSES.pending;
            return (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-tz-fg">{file.file_name ?? file.title}</p>
                  <p className="font-mono text-xs text-tz-muted">
                    v{file.version} · {formatSizeT(t, file.file_size)} · {file.mime_type ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {file.scan_status === "clean" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-tz-success-fg">
                      <ShieldCheck size={13} /> {t("filesVerified")}
                    </span>
                  ) : (
                    <span className={`tz-badge ${scanCls}`}>
                      <ShieldAlert size={12} className="mr-1 inline" />
                      {getScanLabel(t, file.scan_status)}
                    </span>
                  )}
                  <button
                    onClick={() => void download(file.id)}
                    className="tz-btn tz-btn-ghost"
                    aria-label={t("filesDownloadAria", { name: file.file_name ?? "" })}
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
