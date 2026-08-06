/**
 * T-004. Резолвер режима адаптера по переменной окружения DATA_ADAPTER.
 *
 * Чистый модуль без импорта данных — юнит-тестируется из node --test.
 */

export type AdapterMode = "mock" | "api";

/** Режим адаптера: DATA_ADAPTER=mock|api, по умолчанию mock. */
export function resolveAdapterMode(
  env: Record<string, string | undefined>,
): AdapterMode {
  const raw = (env.DATA_ADAPTER ?? "mock").trim().toLowerCase();
  return raw === "api" ? "api" : "mock";
}
