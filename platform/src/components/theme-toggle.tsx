"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Star, Sun } from "lucide-react";
import {
  THEMES,
  applyTheme,
  getSystemTheme,
  resolveTheme,
  type Theme,
} from "@/lib/theme";

const LABELS: Record<Theme, string> = {
  light: "Светлая",
  dark: "Тёмная",
  udmurt: "Удмуртская",
};

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  udmurt: Star,
};

/**
 * T-001. Переключатель тем: сегмент-контрол из трёх значений (не пилюля-кнопка).
 * role=radiogroup + radio с aria-checked, roving tabindex, стрелки влево/вправо.
 * Текущая тема читается из data-theme на <html> (уже установлен inline-скриптом
 * до гидратации — рассинхрона с серверным рендером нет).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    (async () => {
      const applied = document.documentElement.getAttribute("data-theme");
      setTheme(resolveTheme(applied as Theme | null, getSystemTheme()));
    })();
  }, []);

  const select = (next: Theme) => {
    applyTheme(next, document, window.localStorage);
    setTheme(next);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const dir = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + dir + THEMES.length) % THEMES.length;
    const next = THEMES[nextIndex];
    select(next);
    buttonsRef.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className="inline-flex items-center gap-0.5 rounded-control border border-border-subtle bg-surface p-1"
    >
      {THEMES.map((value, index) => {
        const Icon = ICONS[value];
        const active = theme === value;
        return (
          <button
            key={value}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABELS[value]}
            title={LABELS[value]}
            tabIndex={active ? 0 : -1}
            onClick={() => select(value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={[
              "inline-flex h-9 items-center gap-2 rounded-[6px] px-3 text-sm font-medium",
              "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
              active
                ? "bg-accent-soft text-accent"
                : "text-secondary hover:bg-accent-soft/60 hover:text-primary",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{LABELS[value]}</span>
          </button>
        );
      })}
    </div>
  );
}
