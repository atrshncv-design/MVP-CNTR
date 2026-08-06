"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  PUBLIC_TASK_NAV,
  isTaskActive,
} from "@/components/nav-task-list";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";

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

/**
 * T-002. Публичный header (Design.md §11.1): identity Центра,
 * задача-first навигация (§4.1), глобальный поиск (entry), переключатель
 * тем, вход и primary-действие «Подать технологию».
 *
 * Breakpoints (D-02, фикс переполнения): на 1280–1535 суммарная натуральная
 * ширина (6 подписей навигации ≈600px + тема ≈348px + поиск с текстом + CTA)
 * превышает бюджет контейнера 1216px, поэтому навигация живёт в drawer
 * (бургер) до 2xl; inline-навигация возвращается только на 2xl+, где
 * контейнер расширяется до 1600px и поиск схлопывается в иконку.
 */
export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Блокируем прокрутку страницы под открытым drawer */
  useEffect(() => {
    (async () => {
      document.body.style.overflow = menuOpen ? "hidden" : "";
    })();
  }, [menuOpen]);

  /* Закрытие по Escape */
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  /* При смене маршрута drawer закрывается (текущий раздел виден в шапке) */
  useEffect(() => {
    (async () => {
      setMenuOpen(false);
    })();
  }, [pathname]);

  const closeMenu = () => setMenuOpen(false);

  const navLinkClasses = (active: boolean) =>
    [
      "inline-flex h-10 items-center rounded-control px-2 text-small font-medium transition-colors",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
      active
        ? "bg-accent-soft text-accent"
        : "text-secondary hover:bg-surface-elevated hover:text-primary",
    ].join(" ");

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-5 md:px-8 2xl:max-w-[1600px] 2xl:gap-2">
        {/* Identity */}
        <Link
          href="/"
          aria-label="ЦНТР Удмуртии — на главную"
          className="flex min-w-0 items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <BrandMark />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-small font-semibold text-primary">
              ЦНТР Удмуртии
            </span>
            <span className="hidden truncate text-meta text-muted 2xl:block">
              Центр научно-технологического развития
            </span>
          </span>
        </Link>

        {/* Задача-first навигация (desktop). Inline только на 2xl+: на
           1280–1535 суммарная ширина (6 подписей + тема + поиск + CTA)
           превышает бюджет контейнера, поэтому навигация живёт в drawer. */}
        <nav
          aria-label="Разделы платформы"
          className="ml-2 hidden items-center gap-0 2xl:flex"
        >
          {PUBLIC_TASK_NAV.map((item) => {
            const active = isTaskActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={navLinkClasses(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Правая группа */}
        <div className="ml-auto flex items-center gap-1.5 md:gap-2 2xl:gap-1.5">
          {/* Поиск-entry: иконочная кнопка 44px на всех ширинах — текстовая
              версия с kbd переполняла хедер на 1024–1535 (scrollWidth 1474
              при viewport 1280; span/kbd вложены в кнопку, поэтому селектор
              [&_button_span]). Модалка поиска открывается из иконки;
              текстовая версия есть в мобильном drawer. */}
          <div className="[&_button_span]:hidden [&_button_kbd]:hidden">
            <GlobalSearch />
          </div>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <Link
            href="/login"
            className="hidden h-11 items-center rounded-control px-3 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated hover:text-primary md:inline-flex 2xl:px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="hidden h-11 items-center rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 md:inline-flex 2xl:px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Подать технологию
          </Link>

          {/* Бургер (drawer: <2xl) */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-border-subtle bg-surface text-primary transition-colors hover:border-border-strong 2xl:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Drawer (навигация + поиск + тема + CTA): <2xl */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 2xl:hidden" id="public-mobile-menu">
          {/* Оверлей */}
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={closeMenu}
            className="absolute inset-0 block h-full w-full cursor-default bg-overlay"
          />
          {/* Панель */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Меню платформы"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-border-subtle px-5">
              <span className="text-small font-semibold text-primary">
                Меню платформы
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Закрыть меню"
                className="inline-flex h-11 w-11 items-center justify-center rounded-control text-secondary transition-colors hover:bg-surface-elevated hover:text-primary"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav
              aria-label="Разделы платформы"
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              <ul className="flex flex-col gap-1">
                {PUBLIC_TASK_NAV.map((item) => {
                  const active = isTaskActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "flex min-h-11 flex-col justify-center rounded-control px-3 py-2",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                          active
                            ? "bg-accent-soft"
                            : "hover:bg-surface-elevated",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "text-small font-medium",
                            active ? "text-accent" : "text-primary",
                          ].join(" ")}
                        >
                          {item.label}
                          {active ? (
                            <span className="ml-2 text-meta text-accent">
                              · текущий раздел
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 text-meta text-muted">
                          {item.description}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 border-t border-border-subtle pt-5">
                <span className="mb-2 block text-meta font-medium uppercase tracking-wide text-muted">
                  Поиск
                </span>
                <GlobalSearch />
              </div>
            </nav>

            <div className="flex flex-col gap-4 border-t border-border-subtle p-5">
              <ThemeToggle />
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-border-strong text-small font-medium text-primary transition-colors hover:bg-surface-elevated"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  onClick={closeMenu}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90"
                >
                  Подать технологию
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
