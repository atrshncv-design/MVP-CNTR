"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getVisibleMenuItems, MORE_MENU_LABEL } from "@/lib/more-menu";

/**
 * Кнопка «Больше функций» с выпадающей сеткой карточек (по образцу
 * internal-ux-redesign). Открытие/закрытие по клику на кнопке, закрытие по
 * клику вне панели (pointerdown) и по Escape, aria-expanded/aria-haspopup/
 * aria-controls, фокус в панель при открытии и возврат на кнопку по Escape.
 * Пункты фильтруются по ролям сессии через getVisibleMenuItems /
 * allowedRolesFor (src/lib/roles.ts) — ссылки, которые middleware запретит
 * роли, в меню не показываются вовсе. Least-privileged: без известных ролей
 * остаются только пункты без ролевых ограничений (админ-пунктов нет).
 */
export default function MoreFunctionsMenu({
  onNavigate,
  userRoles,
}: {
  onNavigate?: () => void;
  /** Роли текущей сессии (slug-и из session.user.roles); undefined/[] — только unrestricted-пункты. */
  userRoles?: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Ролевая фильтрация всегда: пустые/неизвестные роли → unrestricted-only.
  const items = getVisibleMenuItems(userRoles);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Клик вне панели (включая триггер — он внутри container) и Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Фокус-менеджмент: при открытии фокус переходит в панель.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="more-functions-panel"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          open
            ? "bg-tz-accent-soft text-tz-accent"
            : "text-tz-secondary hover:bg-tz-surface-2 hover:text-tz-fg"
        }`}
      >
        {MORE_MENU_LABEL}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id="more-functions-panel"
          ref={panelRef}
          role="region"
          aria-label={MORE_MENU_LABEL}
          tabIndex={-1}
          className="absolute left-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-tz-border bg-tz-surface p-2"
          style={{
            boxShadow: "var(--tz-shadow-pop)",
            animation: "tz-scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <ul className="grid grid-cols-2 gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="group flex flex-col items-start gap-1.5 rounded-xl px-3 py-2.5 transition hover:bg-tz-surface-2"
                >
                  <item.icon size={18} aria-hidden="true" className="text-tz-accent" />
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium text-tz-fg">
                    {item.label}
                    {!item.isReady && (
                      <span className="tz-badge tz-badge-neutral">В разработке</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
