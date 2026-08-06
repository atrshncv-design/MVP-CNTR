"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * T-003. Мобильный drawer (Design.md §8.3): сайдбар слева + оверлей.
 * Закрытие — по Escape, оверлею и крестику; прокрутка страницы блокируется;
 * закрывается при смене маршрута (вызывающий код слушает usePathname).
 * Тач-цели всех элементов ≥44px.
 */
export function MobileDrawer({ open, onClose, title, children }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Оверлей */}
      <button
        type="button"
        aria-label="Закрыть меню"
        onClick={onClose}
        className="absolute inset-0 block h-full w-full cursor-default bg-overlay"
      />
      {/* Панель */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 left-0 flex w-full max-w-[300px] flex-col bg-surface shadow-xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <span className="text-small font-semibold text-primary">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть меню"
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
