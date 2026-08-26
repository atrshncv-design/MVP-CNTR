"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import HeaderNav, { type HeaderNavItem } from "@/components/dashboard/header-nav";

/**
 * Mobile shell: логотип остаётся в layout, здесь — только кнопка меню (бургер).
 * По клику раскрывается панель с теми же пунктами, что и в desktop-шапке.
 * Закрытие: повторный клик, клик вне панели, Escape.
 */
export default function MobileNav({
  items,
  userRoles,
}: {
  items: HeaderNavItem[];
  /** Роли сессии для ролевой фильтрации пунктов «Больше функций». */
  userRoles?: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="Меню"
        className="grid h-10 w-10 place-items-center rounded-xl text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg"
      >
        {open ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <Menu size={20} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-tz-border bg-tz-surface p-2"
          style={{
            boxShadow: "var(--tz-shadow-pop)",
            animation: "tz-scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <HeaderNav items={items} vertical onNavigate={() => setOpen(false)} userRoles={userRoles} />
        </div>
      )}
    </div>
  );
}
