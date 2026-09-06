"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

export function FileUpload({
  onFiles,
  accept = ".pdf,.docx,.xlsx,.jpg,.png",
  maxSizeMb = 25,
  multiple,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  maxSizeMb?: number;
  multiple?: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const t = useTranslations("dashboard");

  const handle = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const tooLarge = list.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooLarge) {
      setError(t("uiFileTooLarge", { name: tooLarge.name, size: maxSizeMb }));
      return;
    }
    setError(null);
    onFiles(list);
  };

  const headingId = React.useId();
  const errorId = React.useId();
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };
  return (
    <div
      className="tz-card border-dashed p-6 text-center"
      role="group"
      aria-labelledby={headingId}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handle(e.dataTransfer.files);
      }}
    >
      <Upload size={22} className="mx-auto text-tz-muted" aria-hidden="true" />
      <p id={headingId} className="mt-2 text-sm text-tz-secondary">
        {t("uiFileDrop")}{" "}
        <button
          type="button"
          className="font-semibold text-tz-accent underline"
          onClick={() => inputRef.current?.click()}
          aria-label={t("uiFilePickAria")}
        >
          {t("uiFilePickLink")}
        </button>
      </p>
      <p className="mt-1 text-xs text-tz-muted">
        {t("uiFileLimits", { accept, size: maxSizeMb })}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        aria-label={t("uiFileUploadAria")}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(e) => handle(e.target.files)}
        tabIndex={-1}
      />
      {/* клавиатурный доступ: фокус на группу срабатывает */}
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:mt-3 focus:inline-flex focus:rounded focus:border focus:border-tz-accent focus:px-3 focus:py-1 focus:text-sm"
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyDown}
      >
        {t("uiFilePickButton")}
      </button>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-xs text-tz-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
