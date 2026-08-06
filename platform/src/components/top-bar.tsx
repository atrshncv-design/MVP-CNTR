"use client";

import type { ReactNode } from "react";
import { ChevronRight, Menu } from "lucide-react";

export interface TopBarProps {
  /** Заголовок текущего раздела (контекст top bar, Design.md §11.1). */
  title: string;
  /** Хлебные крошки (цепочка разделов; на mobile показывается только заголовок). */
  breadcrumbs?: string[];
  /** Правая группа действий: поиск, уведомления, тема, профиль. */
  right?: ReactNode;
  /** Открыть мобильный drawer (бургер виден только на mobile). */
  onMenuOpen: () => void;
  /** Подпись кнопки меню. */
  menuLabel?: string;
  /** Плотность: кабинеты — обычная, операционный центр — плотная. */
  density?: "comfortable" | "dense";
}

/**
 * T-003. Контекстный top bar: заголовок раздела/хлебные крошки, поиск-entry,
 * уведомления, тема, профиль. Стабилен при loading/empty/error дочерних
 * страниц; на mobile — компактная полоса текущего раздела + бургер.
 */
export function TopBar({
  title,
  breadcrumbs = [],
  right,
  onMenuOpen,
  menuLabel = "Открыть меню",
  density = "comfortable",
}: TopBarProps) {
  const dense = density === "dense";
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/85 backdrop-blur">
      <div
        className={`flex items-center gap-2 ${
          dense ? "h-12 px-3 md:gap-3 md:px-4" : "h-16 gap-3 px-4 md:px-6"
        }`}
      >
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label={menuLabel}
          aria-haspopup="dialog"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border-subtle bg-surface text-primary transition-colors hover:border-border-strong lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          {breadcrumbs.length > 1 ? (
            <nav
              aria-label="Хлебные крошки"
              className="hidden min-w-0 items-center gap-1.5 text-meta text-muted sm:flex"
            >
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : null}
                  <span className="truncate">{crumb}</span>
                </span>
              ))}
            </nav>
          ) : null}
          <p
            className={`truncate font-semibold text-primary ${
              dense ? "text-small" : "text-small sm:text-body"
            }`}
          >
            {title}
          </p>
        </div>

        {right ? (
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">{right}</div>
        ) : null}
      </div>
    </header>
  );
}
