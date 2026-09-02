"use client";

import * as React from "react";
import { X } from "lucide-react";

/**
 * Модалка с WCAG AA: фокус-ловушка, Escape, возврат фокуса, aria-labelledby, скролл-лок.
 * Почему так: axe требует 0 violations — диалог должен иметь доступное имя,
 * ловушка Tab+Shift+Tab и закрытие по Escape, без потери фокуса после закрытия.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  ariaLabel,
  ariaDescribedBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Явный aria-label если заголовка нет */
  ariaLabel?: string;
  ariaDescribedBy?: string;
}) {
  const titleId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);

  // Фокус-ловушка + Escape + скролл-лок (R03)
  React.useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // фокус на диалог или первый интерактивный
    const focusTarget = () => {
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0] as HTMLElement | undefined;
      if (first) first.focus();
      else {
        dialog.focus();
      }
    };
    // небольшая задержка чтобы DOM успел смонтироваться
    const t = setTimeout(focusTarget, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      // возврат фокуса
      prevFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const labelledBy = title ? titleId : undefined;
  const label = ariaLabel ?? (title ? undefined : "Диалог");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tz-fg/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
      aria-describedby={ariaDescribedBy}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="tz-card max-h-[85vh] w-full max-w-lg overflow-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-tz-border p-5">
          {title ? (
            <h2 id={titleId} className="tz-card-title">
              {title}
            </h2>
          ) : (
            <span aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="tz-btn tz-btn-ghost tz-btn-sm"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
