"use client";

import { Star } from "lucide-react";

/**
 * Звёздочка избранного — localStorage per-реестр (тикет 04, R24.1).
 * Почему отдельный компонент: переиспользуется во всех карточках
 * реестров, хранит id в `tz:favorites:{registry}` без бэка.
 * Тест: клик → localStorage, фильтр «Избранное» показывает только отмеченные.
 */
export function FavoriteStar({
  active,
  onToggle,
  size = 18,
  label = "Избранное",
}: {
  active: boolean;
  onToggle: () => void;
  size?: number;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? `Убрать из избранного: ${label}` : `В избранное: ${label}`}
      title={active ? "Убрать из избранного" : "В избранное"}
      className={`grid h-8 w-8 place-items-center rounded-full border transition ${
        active
          ? "border-tz-accent bg-tz-accent-soft text-tz-accent"
          : "border-tz-border bg-tz-surface text-tz-muted hover:border-tz-accent hover:text-tz-accent"
      }`}
    >
      <Star size={size} className={active ? "fill-current" : ""} aria-hidden="true" />
    </button>
  );
}
