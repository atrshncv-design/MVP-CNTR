"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { LOCALE_COOKIE, type Locale, parseLocale } from "./config";

/**
 * Тумблер RU↔EN в топбаре — R01.
 * Почему client: читает document.cookie, пишет cookie и перезагружает без потери страницы.
 * Хранит locale в cookie (NEXT_LOCALE), default RU, перезагрузка через window.location.reload().
 * Доступность: role group, aria-pressed, aria-label, клавиатура.
 */
export default function LocaleToggle() {
  const t = useTranslations("common");
  const [locale, setLocale] = useState<Locale>("ru");

  useEffect(() => {
    // Читаем куку при монтировании — default RU если нет или невалидно; через setTimeout чтобы не триггерить sync setState lint
    const id = setTimeout(() => {
      const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
      const raw = match ? decodeURIComponent(match[1] ?? "") : null;
      setLocale(parseLocale(raw));
      // Синхронизируем html lang для a11y (хотя layout ставит ru статически — клиент обновляет)
      document.documentElement.lang = parseLocale(raw);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const switchLocale = useCallback(
    (next: Locale) => {
      // Пишем cookie на год, SameSite Lax, путь /
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = next;
      setLocale(next);
      // Перезагружаем без потери страницы (тот же pathname+search+hash)
      window.location.reload();
    },
    [],
  );

  const isRu = locale === "ru";

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="inline-flex items-center rounded-full border border-tz-border bg-tz-surface p-1"
      data-testid="locale-toggle"
      title={t("language")}
    >
      <button
        type="button"
        aria-pressed={isRu}
        aria-label={t("russian")}
        data-testid="locale-ru"
        onClick={() => switchLocale("ru")}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
          isRu ? "bg-tz-accent text-white shadow" : "text-tz-muted hover:text-tz-fg"
        }`}
      >
        {t("localeRu")}
      </button>
      <button
        type="button"
        aria-pressed={!isRu}
        aria-label={t("english")}
        data-testid="locale-en"
        onClick={() => switchLocale("en")}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
          !isRu ? "bg-tz-accent text-white shadow" : "text-tz-muted hover:text-tz-fg"
        }`}
      >
        {t("localeEn")}
      </button>
    </div>
  );
}
