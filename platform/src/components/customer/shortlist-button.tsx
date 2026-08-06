/**
 * T-008. Кнопка «В шорт-лист» (клиент, localStorage).
 *
 * Один источник истины — `src/lib/customer-storage.ts` (ключ nfr-shortlists).
 * Состояние инициализируется из localStorage при монтировании (useEffect +
 * async IIFE — паттерн, проходящий react-hooks/set-state-in-effect);
 * переключение пишет в хранилище и обновляет локальное состояние.
 */

"use client";

import { useEffect, useState } from "react";
import { Check, FolderPlus } from "lucide-react";
import {
  addToShortlist,
  isInShortlist,
  removeFromShortlist,
} from "@/lib/customer-storage";

export interface ShortlistButtonProps {
  /** id технологии (в контексте T-008 — id технологии-фикстуры). */
  technologyId: string;
  /** Название технологии (для aria-label). */
  title?: string;
  /** Компактный вариант (в карточках списков). */
  size?: "sm" | "md";
  className?: string;
}

export function ShortlistButton({
  technologyId,
  title = "",
  size = "md",
  className = "",
}: ShortlistButtonProps) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    (async () => {
      setInList(isInShortlist(technologyId));
    })();
  }, [technologyId]);

  const toggle = () => {
    if (inList) {
      removeFromShortlist(technologyId);
      setInList(false);
    } else {
      addToShortlist(technologyId);
      setInList(true);
    }
  };

  const label = inList ? "В шорт-листе" : "В шорт-лист";
  const sizeClasses =
    size === "sm"
      ? "h-9 gap-1.5 px-3 text-meta"
      : "h-11 gap-2 px-4 text-small";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={inList}
      aria-label={`${label}${title ? `: ${title}` : ""}`}
      className={`inline-flex items-center rounded-control font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
        inList
          ? "bg-status-success-soft text-status-success hover:bg-status-success-soft"
          : "border border-strong bg-surface text-primary hover:border-accent hover:text-accent"
      } ${sizeClasses} ${className}`}
    >
      {inList ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <FolderPlus className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
