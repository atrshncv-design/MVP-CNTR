"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionDef } from "@/lib/roles";
import { findDeepestSection } from "@/lib/roles";
import { GeometryDivider } from "@/components/udmurt/geometry-divider";

/** Знак Центра: восьмиконечная звезда (толязь) на акцентной плашке. */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-strong text-accent-contrast"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 1 14.2 9.8 23 12 14.2 14.2 12 23 9.8 14.2 1 12 9.8 9.8Z" />
      </svg>
    </span>
  );
}

export interface SidebarGroup {
  /** Заголовок группы (роль кабинета / секция операционного центра). */
  title?: string;
  items: SectionDef[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  /** Текущий путь — для подсветки (aria-current="page" у активного раздела). */
  activePath: string;
  /** Плотность: кабинеты инструментальные, операционный центр — плотный. */
  density?: "comfortable" | "dense";
  /** Заголовок навигации (aria-label). */
  navLabel?: string;
  /** Подпись под знаком (кабинет / операционный центр). */
  brandSubtitle?: string;
  /** Куда ведёт знак Центра (корень шелла). */
  brandHref?: string;
  /** Показывать ли блок identity (в мобильном drawer — нет, там свой заголовок). */
  showBrand?: boolean;
  /** Нижний блок (роль-свитчер, тема). */
  footer?: ReactNode;
  /** Вызывается при переходе (закрыть drawer). */
  onNavigate?: () => void;
}

/**
 * T-003. Ролевой сайдбар (Design.md §4.2): общие разделы + ролевые
 * в порядке приоритета роли; масштабируется через реестр разделов
 * (src/lib/roles.ts) — новый модуль добавляется одной записью.
 * Текущий маршрут подсвечен и помечен aria-current="page".
 */
export function Sidebar({
  groups,
  activePath,
  density = "comfortable",
  navLabel = "Навигация кабинета",
  brandSubtitle = "Личный кабинет",
  brandHref = "/app",
  showBrand = true,
  footer,
  onNavigate,
}: SidebarProps) {
  const dense = density === "dense";

  /* Один активный раздел — самый конкретный (глубокий) из совпавших. */
  const allSections = groups.flatMap((group) => group.items);
  const activeSection = findDeepestSection(activePath, allSections);
  const activeId = activeSection?.id ?? null;

  const rowClasses = (active: boolean) =>
    [
      "relative flex items-center rounded-control font-medium transition-colors",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
      // D-09: строки ≥44px (тач-цели и плотность сайдбара), маркер активного раздела — полоса 3px слева.
      dense ? "h-11 gap-2 rounded-[6px] px-2.5 text-small" : "h-11 gap-2.5 px-3 text-small",
      active
        ? "bg-accent-soft text-accent"
        : "text-secondary hover:bg-surface-elevated hover:text-primary",
    ].join(" ");

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {showBrand ? (
        <Link
          href={brandHref}
          aria-label={`ЦНТР Удмуртии — ${brandSubtitle}`}
          className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border-subtle px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate text-small font-semibold text-primary">
              ЦНТР Удмуртии
            </span>
            <span className="block truncate text-meta text-muted">
              {brandSubtitle}
            </span>
          </span>
        </Link>
      ) : null}

      <nav
        aria-label={navLabel}
        className={`min-h-0 flex-1 overflow-y-auto ${dense ? "px-2 py-3" : "px-3 py-4"}`}
      >
        {groups.map((group, index) => {
          if (group.items.length === 0) return null;
          return (
            <div
              key={group.title ?? `group-${index}`}
              className={index > 0 ? "mt-2.5" : undefined}
            >
              {/* D-09: разделитель ролевых секций — GeometryDivider (D-06):
                  в udmurt-теме ряд звёзд «толэзё», в светлой/тёмной — тонкая линия. */}
              {index > 0 ? <GeometryDivider className="mb-2.5" /> : null}
              {group.title ? (
                <p
                  className={`mb-1.5 font-medium uppercase tracking-wider text-muted ${
                    dense ? "px-2.5 text-[11px]" : "px-3 text-meta"
                  }`}
                >
                  {group.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.id === activeId;
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={rowClasses(active)}
                      >
                        {/* D-09: маркер активного раздела — полоса 3px слева (токен акцента). */}
                        {active ? (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-accent"
                          />
                        ) : null}
                        <Icon
                          className={`shrink-0 ${dense ? "h-4 w-4" : "h-[18px] w-[18px]"}`}
                          aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                        {item.description ? (
                          <span className="sr-only">{item.description}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {footer ? (
        <div className={`shrink-0 border-t border-border-subtle ${dense ? "p-2.5" : "p-3"}`}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
