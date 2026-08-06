"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Star } from "lucide-react";

import type { ThemeName } from "@/lib/theme";

export type { ThemeName } from "@/lib/theme";

const THEMES: { id: ThemeName; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Светлая тема", Icon: Sun },
  { id: "dark", label: "Тёмная тема", Icon: Moon },
  { id: "udmurt", label: "Удмуртская тема", Icon: Star },
];

import { applyTheme, getStoredTheme } from "@/lib/theme";

/** Читает сохранённую тему с учётом системной (только на клиенте). */
export function getStoredThemeSafe(): ThemeName {
  if (typeof window === "undefined") return "light";
  return getStoredTheme(
    window.localStorage,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

export default function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    (async () => {
      setTheme(getStoredThemeSafe());
      setMounted(true);
    })();
  }, []);

  const select = (next: ThemeName) => {
    setTheme(next);
    applyTheme(next, { documentElement: document.documentElement, storage: window.localStorage });
  };

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${
          onDark ? "border-white/15" : "border-tz-border"
        }`}
      >
        <Sun className="h-3.5 w-3.5 opacity-0" />
      </div>
    );
  }

  const base = onDark
    ? "text-white/60 hover:bg-white/10 hover:text-white"
    : "text-tz-secondary hover:bg-tz-soft hover:text-tz-fg";
  const active = onDark
    ? "bg-white/15 text-white"
    : "bg-tz-accent-soft text-tz-accent";

  return (
    <div
      role="group"
      aria-label="Переключатель темы: светлая, тёмная, удмуртская"
      className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${
        onDark ? "border-white/15 bg-white/[0.06]" : "border-tz-border bg-tz-surface"
      }`}
    >
      {THEMES.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-pressed={theme === id}
          title={label}
          onClick={() => select(id)}
          className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
            theme === id ? active : base
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
