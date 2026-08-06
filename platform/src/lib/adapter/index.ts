/**
 * T-004. Фабрика адаптера данных.
 *
 * Переключение источника данных — одна строка окружения:
 *   DATA_ADAPTER=mock|api   (по умолчанию mock)
 *
 * Mock-адаптер работает на реальных 400 карточках НИОКТР
 * (src/data/nioktr-fixtures.json). API-адаптер в P0 — стаб-скелет
 * с теми же сигнатурами (бросает «не подключено»).
 *
 * ВАЖНО: файл импортирует JSON — подключается только в серверном коде
 * (route loaders/actions). Клиентские компоненты получают данные через
 * серверные loaders и никогда не вызывают адаптер напрямую.
 */

import nioktrDataset from "../../data/nioktr-fixtures.json";
import type { NioktrDataset } from "../types.ts";
import type { PlatformDataAdapter } from "./types.ts";
import { MockPlatformDataAdapter } from "./mock-adapter.ts";
import { ApiAdapterStub } from "./api-stub.ts";
import { resolveAdapterMode } from "./mode.ts";

let cachedAdapter: PlatformDataAdapter | null = null;

/**
 * Создать адаптер по окружению (без кэша — для тестов и SSR-запросов).
 * env по умолчанию — process.env.
 */
export function createAdapter(
  env: Record<string, string | undefined> = process.env,
): PlatformDataAdapter {
  const mode = resolveAdapterMode(env);
  if (mode === "api") {
    return new ApiAdapterStub();
  }
  return new MockPlatformDataAdapter({
    dataset: nioktrDataset as NioktrDataset,
  });
}

/**
 * Единая точка доступа к адаптеру в route loaders/actions.
 * Кэширует экземпляр на время жизни процесса (dev: на время сервера).
 */
export function getAdapter(
  env: Record<string, string | undefined> = process.env,
): PlatformDataAdapter {
  if (!cachedAdapter) {
    cachedAdapter = createAdapter(env);
  }
  return cachedAdapter;
}

/** Сбросить кэш (для тестов и смены DATA_ADAPTER в рантайме). */
export function resetAdapterCache(): void {
  cachedAdapter = null;
}
