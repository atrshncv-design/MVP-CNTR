/**
 * D-06. Маркер перед заголовком раздела (Design.md §9.4, тикет D-06):
 * в удмуртской теме — маленькая восьмиконечная звезда «толэзё»,
 * в светлой/тёмной — сдержанный квадрат-ромб на токене акцента.
 * Без явного theme компонент сам переключается по data-theme через CSS
 * (SSR-safe, без JS), поэтому маркер виден сразу при первом рендере.
 * Маркер идёт ВМЕСТЕ с текстом (label) — это доступное имя элемента,
 * сама геометрия декоративная (aria-hidden).
 */

import type { ThemeName } from "@/lib/theme";
import { UdmurtStar } from "@/components/udmurt/star";
import "./udmurt.css";

export interface SectionMarkProps {
  /** Подпись маркера — видимый текст рядом с геометрией. */
  label: string;
  /** Явный выбор варианта; без значения — по текущей теме (CSS). */
  theme?: ThemeName;
  /**
   * Классы текстовой подписи. Без значения подпись стилизуется как
   * мета-строка (font-mono text-meta text-muted) — под eyebrow досье.
   */
  className?: string;
}

export function SectionMark({ label, theme, className = "" }: SectionMarkProps) {
  const explicit =
    theme === "udmurt" ? "udmurt" : theme === "light" || theme === "dark" ? "neutral" : null;
  const showUdmurt = explicit !== "neutral";
  const showNeutral = explicit !== "udmurt";

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {showUdmurt ? (
        <span
          aria-hidden
          className={`shrink-0 items-center ${explicit === null ? "d06-udmurt-only" : "flex"}`}
        >
          <UdmurtStar size={16} />
        </span>
      ) : null}
      {showNeutral ? (
        <span
          aria-hidden
          className={`shrink-0 items-center ${explicit === null ? "d06-neutral-only" : "flex"}`}
        >
          <span className="block h-2 w-2 rotate-45 bg-accent" />
        </span>
      ) : null}
      <span className={`min-w-0 ${className || "font-mono text-meta text-muted"}`}>{label}</span>
    </span>
  );
}
