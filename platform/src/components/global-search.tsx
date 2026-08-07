"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * T-002. Глобальный поиск — entry-контрол.
 * Реальный поиск появится в T-006 (/find); сейчас контрол ведёт
 * на discovery-хаб. Стилизован как поле поиска (кликабельная кнопка),
 * на мобильном схлопывается до иконки с тач-целью 44px.
 * Сочетание клавиш «/» открывает поиск (кроме ввода в полях).
 */
export function GlobalSearch() {
  const router = useRouter();

  const openSearch = () => {
    router.push("/find");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (isTyping) return;
      event.preventDefault();
      router.push("/find");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={openSearch}
        aria-label="Открыть поиск по платформе"
        className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-control border border-border-subtle bg-surface px-2.5 text-secondary transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring xl:h-10 xl:min-w-10"
      >
        <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
        <span className="hidden whitespace-nowrap text-small 2xl:inline">
          Поиск по платформе
        </span>
        <kbd
          aria-hidden
          className="hidden rounded-[4px] border border-border-subtle bg-canvas px-1.5 py-0.5 font-mono text-meta text-muted 2xl:inline"
        >
          /
        </kbd>
      </button>
    </div>
  );
}
