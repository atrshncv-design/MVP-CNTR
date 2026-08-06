"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

export interface NotificationBellProps {
  /**
   * Ссылка «Все уведомления» (раздел /app/notifications — контент T-012).
   * В операционном шелле может отсутствовать — тогда показывается только
   * панель-заглушка.
   */
  linkHref?: string;
}

/**
 * T-003. Entry уведомлений: колокольчик с панелью. Контент уведомлений
 * наполняется в T-012; сейчас — честное пустое состояние (STATES.md §3)
 * без выдуманных счётчиков и событий. Доступно без hover (тач-цель 44px).
 */
export function NotificationBell({ linkHref }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Уведомления"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-border-subtle bg-surface text-secondary transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {open ? (
        <>
          {/* Оверлей-закрытие (внешний клик) */}
          <button
            type="button"
            aria-label="Закрыть уведомления"
            onClick={close}
            className="fixed inset-0 z-40 block h-full w-full cursor-default bg-transparent"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Уведомления"
            className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="text-small font-semibold text-primary">
                Уведомления
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть"
                className="inline-flex h-9 w-9 items-center justify-center rounded-control text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="p-4">
              <EmptyState
                compact
                icon={Bell}
                title="Пока нет уведомлений"
                description="События по проектам, заявкам и решениям появятся здесь."
              />
            </div>
            {linkHref ? (
              <div className="border-t border-border-subtle p-3">
                <Link
                  href={linkHref}
                  onClick={close}
                  className="inline-flex h-11 w-full items-center justify-center rounded-control border border-border-strong text-small font-medium text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Все уведомления
                </Link>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
