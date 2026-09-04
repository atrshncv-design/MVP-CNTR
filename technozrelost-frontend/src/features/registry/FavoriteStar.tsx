"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

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
  label,
}: {
  active: boolean;
  onToggle: () => void;
  size?: number;
  label?: string;
}) {
  const t = useTranslations("registry");
  const name = label ?? t("favDefaultLabel");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={active ? t("favRemove", { label: name }) : t("favAdd", { label: name })}
      title={active ? t("favRemoveTitle") : t("favAddTitle")}
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
