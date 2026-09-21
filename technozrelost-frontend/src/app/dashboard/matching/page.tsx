import { getTranslations } from "next-intl/server";

import { MatchingMode } from "@/features/matching";
import { P2_MATCHING_ENABLED } from "@/lib/release";

/**
 * Подбор исполнителей (таск 04, R04, G36).
 * Почему тонкая обёртка: вся логика — в MatchingMode (форма, POST /match,
 * 8 состояний, ретрай); страница только монтирует экран в ЛК.
 * Доступ — по матрице ролей (roles.ts, все аутентифицированные роли),
 * fail-closed через middleware; без LLM-ключа бэк отвечает скриптовым
 * режимом 200.
 *
 * Серверная версия (2026-09-21): экран временно скрыт флагом
 * P2_MATCHING_ENABLED — вместо MatchingMode нейтральная заглушка без
 * AI-текстов. Возврат: P2_MATCHING_ENABLED=true в src/lib/release.ts.
 */
export default async function MatchingPage() {
  if (!P2_MATCHING_ENABLED) {
    const t = await getTranslations("dashboard");
    return (
      <div className="tz-card tz-empty p-10 text-center" data-testid="matching-hidden">
        <h1 className="tz-empty-title">{t("sectionHiddenTitle")}</h1>
        <p className="tz-empty-text">{t("sectionHiddenDesc")}</p>
      </div>
    );
  }
  return <MatchingMode />;
}
