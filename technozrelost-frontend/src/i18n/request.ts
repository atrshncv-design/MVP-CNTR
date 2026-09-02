import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, parseLocale } from "./config";

/**
 * next-intl server config — зона src/i18n/request.ts.
 * Почему здесь: next-intl/plugin читает этот файл (см. next.config.ts).
 * Читает locale из cookie (default RU, fail-closed), грузит messages.
 * Поддерживает оба пути сообщений: src/messages/* и messages/* (для тестов).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale = parseLocale(raw);

  // Динамический импорт с fallback — в проде сообщения в src/messages, в тестах могут проверять оба пути
  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${locale}.json`)).default;
  }

  return {
    locale,
    messages,
  };
});
