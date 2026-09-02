"use client";

import * as React from "react";
import { Upload } from "lucide-react";

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

  const handle = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const tooLarge = list.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooLarge) {
      setError(`Файл ${tooLarge.name} превышает ${maxSizeMb} МБ`);
      return;
    }
    setError(null);
    onFiles(list);
  };

  return (
    <div className="tz-card border-dashed p-6 text-center">
      <Upload size={22} className="mx-auto text-tz-muted" aria-hidden="true" />
      <p className="mt-2 text-sm text-tz-secondary">
        Перетащите файлы или{" "}
        <button type="button" className="font-semibold text-tz-accent underline" onClick={() => inputRef.current?.click()}>
          выберите
        </button>
      </p>
      <p className="mt-1 text-xs text-tz-muted">
        {accept} до {maxSizeMb} МБ
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      {error ? <p role="alert" className="mt-2 text-xs text-tz-danger">{error}</p> : null}
    </div>
  );
}
