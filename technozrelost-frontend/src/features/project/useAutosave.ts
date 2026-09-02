"use client";

import * as React from "react";

/**
 * useAutosave — автосохранение 30с + beforeunload диалог (G40).
 * Почему 30с: требование G40 «Автосохр + диалог» для черновиков.
 * Сохраняет в localStorage и вызывает onSave, показывает индикатор «Сохранено».
 */
export function useAutosave<T>({
  value,
  onSave,
  intervalMs = 30_000,
  storageKey,
  enabled = true,
}: {
  value: T;
  onSave?: (val: T) => Promise<void> | void;
  intervalMs?: number;
  storageKey?: string;
  enabled?: boolean;
}) {
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const prevRef = React.useRef<string>(JSON.stringify(value ?? null));
  // eslint-disable-next-line react-hooks/refs
  const hasUnsaved = React.useMemo(() => JSON.stringify(value ?? null) !== prevRef.current, [value]);

  // beforeunload диалог
  React.useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = "Есть несохранённые изменения. Покинуть страницу?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved, enabled]);

  // модалка при уходе: опционально можно слушать route change, но beforeunload покрывает перезагрузку/закрытие
  // автосохранение каждые intervalMs
  React.useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(async () => {
      const cur = JSON.stringify(value);
      if (cur === prevRef.current) return;
      setStatus("saving");
      try {
        if (storageKey) localStorage.setItem(storageKey, cur);
        if (onSave) await onSave(value);
        prevRef.current = cur;
        setStatus("saved");
        setLastSavedAt(new Date().toISOString());
        // сброс saved через 3с в idle
        window.setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setStatus("error");
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [value, onSave, intervalMs, storageKey, enabled]);

  // initial load from storage
  const loadFromStorage = React.useCallback((): T | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [storageKey]);

  const reset = React.useCallback(() => {
    prevRef.current = JSON.stringify(value ?? null);
    setStatus("idle");
  }, [value]);

  return { status, lastSavedAt, hasUnsaved, loadFromStorage, reset };
}
