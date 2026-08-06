/**
 * T-006. Состояние ошибки реестра (STATES.md §3 «Error»): inline-рендер
 * внутри страницы (реестр не исчезает целиком), retry через router.refresh()
 * сохраняет текущий URL-запрос (search/filters/sort/page) — повторная
 * попытка не сбрасывает условия поиска.
 */

"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/states/error-state.tsx";

export interface RegistryErrorStateProps {
  /** Что именно не удалось загрузить. */
  title?: string;
  /** Объяснение причины и что попробовать. */
  description?: string;
  /** Маршрут-фолбэк (например "/research"). */
  fallbackHref?: string;
}

export function RegistryErrorState({
  title = "Не удалось загрузить реестр",
  description = "Данные временно недоступны. Проверьте подключение и повторите попытку — условия поиска сохранятся.",
  fallbackHref = "/research",
}: RegistryErrorStateProps) {
  const router = useRouter();
  return (
    <ErrorState
      title={title}
      description={description}
      onRetry={() => router.refresh()}
      fallbackHref={fallbackHref}
    />
  );
}
