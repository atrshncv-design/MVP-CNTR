"use client";

import { LayoutGrid, Table } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Переключатель вида реестров карточки ↔ таблица (P3, R02).
 * Почему отдельный компонент: тумблер переиспользуется во всех 5 реестрах
 * (projects/technologies/organizations/nioktr/executors), хранит состояние
 * per-реестр изолированно. Карточки остаются дефолтом — таблица по требованию.
 * Состояние хранит useRegistryView (localStorage), здесь только UI.
 */
export type RegistryView = "cards" | "table";

export function RegistryViewToggle({
  view,
  onChange,
}: {
  view: RegistryView;
  onChange: (v: RegistryView) => void;
}) {
  const t = useTranslations("registry");
  return (
    <div
      role="group"
      aria-label="Переключатель вида реестра"
      data-i18n-label={t("viewCards")}
      className="inline-flex items-center rounded-xl border border-tz-border bg-tz-surface p-1"
      title={t("viewTable")}
    >
      <button
        type="button"
        onClick={() => onChange("cards")}
        aria-pressed={view === "cards"}
        aria-label="Вид: карточки"
        title="Карточки"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          view === "cards"
            ? "bg-tz-accent text-white shadow-sm"
            : "text-tz-muted hover:bg-tz-soft hover:text-tz-fg"
        }`}
      >
        <LayoutGrid size={16} aria-hidden="true" />
        Карточки
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        aria-pressed={view === "table"}
        aria-label="Вид: таблица"
        title="Таблица"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          view === "table"
            ? "bg-tz-accent text-white shadow-sm"
            : "text-tz-muted hover:bg-tz-soft hover:text-tz-fg"
        }`}
      >
        <Table size={16} aria-hidden="true" />
        Таблица
      </button>
    </div>
  );
}
