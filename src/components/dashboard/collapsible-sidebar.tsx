"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface CollapsibleSidebarProps {
  /**
   * Уникальный id панели: участвует в ключе localStorage
   * (`tz-sidebar-<id>`) и в id тела панели (aria-controls).
   */
  id: string;
  /** Заголовок панели — виден и в свёрнутом состоянии. */
  title: string;
  children: ReactNode;
  /** Необязательная иконка слева от заголовка (элемент, напр. из lucide-react). */
  icon?: ReactNode;
  /**
   * Состояние до чтения localStorage (по умолчанию открыто).
   * Итоговое состояние всегда восстанавливается из localStorage.
   */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Сворачиваемая боковая панель (тикет 03 internal-ux-redesign).
 *
 * - Состояние открыто/свернуто сохраняется в localStorage (ключ
 *   `tz-sidebar-<id>`), чтобы панель запоминала выбор пользователя.
 *   Гидрация — в эффекте с async-IIFE (паттерн react-hooks-lint-rules:
 *   иначе react-hooks/set-state-in-effect); запись — в обработчике клика,
 *   без эффекта (SSR и первый клиентский рендер совпадают — без
 *   hydration mismatch).
 * - Кнопка-заголовок: `aria-expanded` + `aria-controls`; chevron
 *   поворачивается при раскрытии; свёрнутое тело помечается `inert`
 *   (недоступно для фокуса и скринридеров).
 * - Анимация — CSS-переход `grid-template-rows` (0fr ↔ 1fr) через
 *   компонентный класс `.tz-sidebar-collapse` из globals.css; при
 *   `prefers-reduced-motion` глобальное правило обнуляет переход.
 *
 * Питфолл (тикет 01): иконки lucide нельзя передавать элементом из
 * серверного компонента в клиентский проп. `icon` принимает ReactNode —
 * клиентские потребители передают `<Filter size={16} />` напрямую,
 * серверные — опускают или используют клиентскую обёртку.
 */
export default function CollapsibleSidebar({
  id,
  title,
  children,
  icon,
  defaultOpen = true,
  className = "",
}: CollapsibleSidebarProps) {
  const storageKey = `tz-sidebar-${id}`;
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `tz-sidebar-${id}-body`;

  // Восстановить сохранённое состояние ПОСЛЕ гидрации: SSR и первый
  // клиентский рендер рисуют defaultOpen, затем эффект применяет
  // сохранённое значение (async-IIFE — обход react-hooks/set-state-in-effect).
  useEffect(() => {
    (async () => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored === "0" || stored === "1") setOpen(stored === "1");
      } catch {
        /* localStorage недоступен (приватный режим и т.п.) — остаёмся на defaultOpen */
      }
    })();
  }, [storageKey]);

  // Запись в localStorage — в обработчике (write-through), без эффекта.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <aside
      className={`overflow-hidden rounded-xl border border-tz-border bg-tz-surface shadow-[var(--tz-shadow-card)] ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-tz-surface-2"
      >
        {icon ? (
          <span className="grid h-6 w-6 shrink-0 place-items-center text-tz-accent" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tz-fg">{title}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-tz-muted transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div id={bodyId} data-collapsed={open ? "false" : "true"} className="tz-sidebar-collapse" inert={!open || undefined}>
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </aside>
  );
}
