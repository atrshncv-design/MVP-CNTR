"use client";

import { useEffect, useState } from "react";

/**
 * Проверка совместимости браузера (тикет 04, internal-frontend).
 *
 * Стек Next.js 16 / React 19 требует современные браузеры. Если критичные
 * API отсутствуют (IE11/старый Edge, очень старые Safari/Chrome), показываем
 * полноэкранную заглушку с понятным сообщением. Никаких mock-данных —
 * только детекция возможностей и статичный текст.
 */
const SUPPORTED_BROWSERS = [
  "Chrome / Edge 109+",
  "Firefox 102+",
  "Safari 16+",
];

function isBrowserSupported(): boolean {
  if (typeof window === "undefined") return true;
  // IE11 и legacy Edge (EdgeHTML): documentMode !== undefined
  const doc = document as Document & { documentMode?: unknown };
  if (doc.documentMode !== undefined) return false;
  if (typeof window.ResizeObserver === "undefined") return false;
  if (typeof window.AbortController === "undefined") return false;
  if (typeof window.structuredClone === "undefined") return false;
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return true;
}

export default function BrowserSupport() {
  const [unsupported, setUnsupported] = useState(false);

  // Детекция после монтирования: асинхронный setState (не в теле effect
  // синхронно) — соответствует react-hooks/set-state-in-effect.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUnsupported(!isBrowserSupported());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!unsupported) return null;

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-tz-bg p-6"
    >
      <div className="w-full max-w-lg rounded-2xl border border-tz-border bg-tz-surface p-8 text-center shadow-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          ТЕХНОЗРЕЛОСТЬ · ГОСТ Р 58048-2017
        </p>
        <h1 className="mt-3 text-2xl font-bold text-tz-fg">
          Ваш браузер не поддерживается
        </h1>
        <p className="mt-3 leading-relaxed text-tz-secondary">
          Платформа использует современные веб-технологии (React 19, Next.js 16),
          которые не работают в этой версии браузера. Обновите браузер или
          установите актуальную версию одного из поддерживаемых:
        </p>
        <ul className="mt-5 space-y-2 text-left">
          {SUPPORTED_BROWSERS.map((name) => (
            <li
              key={name}
              className="rounded-xl border border-tz-border bg-tz-bg px-4 py-3 font-medium text-tz-fg"
            >
              {name}
            </li>
          ))}
        </ul>
        <a
          href="https://browser-update.org/ru/update.html"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-tz-accent px-6 py-3 font-semibold text-white transition hover:bg-tz-accent-hover"
        >
          Как обновить браузер
        </a>
      </div>
    </div>
  );
}
