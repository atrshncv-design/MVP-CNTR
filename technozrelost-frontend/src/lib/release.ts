/**
 * Граница релиза P2 (таск 02, G04/G05/G06/G09/G35/G36) + открытие
 * matching таском 04 (R04, G36).
 * Почему отдельный модуль: P2 выпускает инфоконтур + весь ЛК одним пакетом,
 * а публичные реестры честно отложены в P3. Флаг matching оставлен как
 * маркер релиза и kill-switch пункта меню; доступ к маршруту дополнительно
 * закрыт матрицей ролей (fail-closed), к API — сессией.
 */

/** Публичные (анонимные) реестры и витрина — откроются в P3 (G04, G35). */
export const P2_PUBLIC_REGISTRIES_ENABLED = false;

/** Подбор партнёра — открыт таском 04 (R04, G36): топ-5 через POST /match. */
export const P2_MATCHING_ENABLED = true;

/** Маркер gated-заглушек: так P3 находит всё отложенное одним поиском. */
export const P2_GATED = "P2_GATED";

/**
 * Сообщение gated-заглушки API-клиента: закрыто релизом, а не сломано.
 * Почему строка с BLOCKED: тот же контракт, что у недоступных шаблонов.
 */
export function p2GatedMessage(feature: "matching" | "public-registry"): string {
  return `BLOCKED: P2 — ${feature} откроется в P3 (G04/G35/G36)`;
}
