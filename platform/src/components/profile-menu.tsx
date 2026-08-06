"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, X } from "lucide-react";
import { clearSession, type MockSession } from "@/lib/session";
import { getRoleDefinition } from "@/lib/roles";

export interface ProfileMenuProps {
  session: MockSession;
  /**
   * Пункты меню. По умолчанию — общие разделы кабинета; операционный шелл
   * передаёт свои («Настройки центра»).
   */
  items?: { label: string; href: string }[];
  /** Плотность: в операционном шелле меню компактнее. */
  density?: "comfortable" | "dense";
}

const DEFAULT_ITEMS = [
  { label: "Профиль", href: "/app/profile" },
  { label: "Организация", href: "/app/organization" },
  { label: "Настройки", href: "/app/settings" },
  { label: "Помощь", href: "/app/help" },
];

/**
 * T-003. Профиль-меню: контекст пользователя (email, роль) и действия.
 * Выход очищает mock-сессию и ведёт на /login (полноценный auth — T-013).
 */
export function ProfileMenu({
  session,
  items = DEFAULT_ITEMS,
  density = "comfortable",
}: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dense = density === "dense";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const definition = getRoleDefinition(session.role);
  const email = session.email;
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  const logout = () => {
    clearSession();
    router.replace("/login");
  };

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Меню профиля"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-11 items-center gap-2 rounded-control border border-border-subtle bg-surface px-2 text-secondary transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-accent-soft text-small font-semibold text-accent">
          {initial}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 ${dense ? "hidden sm:block" : ""}`} aria-hidden />
        <span className="sr-only">{email}</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Закрыть меню профиля"
            onClick={close}
            className="fixed inset-0 z-40 block h-full w-full cursor-default bg-transparent"
          />
          <div
            role="menu"
            aria-label="Меню профиля"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-xl"
          >
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="truncate font-mono text-small text-primary">{email}</p>
              <p className="mt-0.5 truncate text-meta text-muted">
                {definition?.label ?? session.role}
              </p>
            </div>
            <ul className="p-1.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    role="menuitem"
                    className="flex h-10 items-center rounded-[6px] px-3 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border-subtle px-2 py-2">
              <button
                type="button"
                onClick={logout}
                role="menuitem"
                className="inline-flex h-10 flex-1 items-center gap-2 rounded-[6px] px-3 text-small font-medium text-status-danger transition-colors hover:bg-status-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Выйти
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
