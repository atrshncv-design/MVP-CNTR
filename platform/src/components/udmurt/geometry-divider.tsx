/**
 * D-06. Модульный орнаментальный разделитель секций (Design.md §9.4,
 * тикет D-06). В удмуртской теме — видимый ряд звёзд «толэзё» и ромбов
 * между линиями; в светлой/тёмной — сдержанный геометрический мотив
 * (ромб на токене акцента между тонкими линиями), БЕЗ звезды.
 * Высота ≤ 24px, ширина 100%, цвет — только токены.
 * Без явного variant разделитель переключается по data-theme через CSS
 * (SSR-safe, без JS). Компонент декоративный: aria-hidden.
 */

import { UdmurtStar } from "@/components/udmurt/star";
import "./udmurt.css";

export type GeometryDividerVariant = "udmurt" | "light" | "dark";

export interface GeometryDividerProps {
  /** Вариант орнамента; без значения — по текущей теме (CSS). */
  variant?: GeometryDividerVariant | "auto";
  /** Дополнительные классы. */
  className?: string;
}

export function GeometryDivider({ variant = "auto", className = "" }: GeometryDividerProps) {
  const explicit =
    variant === "udmurt" ? "udmurt" : variant === "light" || variant === "dark" ? "neutral" : null;
  const showUdmurt = explicit !== "neutral";
  const showNeutral = explicit !== "udmurt";

  return (
    <div className={`w-full ${className}`} aria-hidden>
      {showUdmurt ? (
        <div
          className={`h-5 w-full items-center gap-2 ${
            explicit === null ? "d06-udmurt-only" : "flex"
          }`}
        >
          <span className="h-px flex-1 bg-border-strong" />
          <UdmurtStar size={16} />
          <span className="block h-2.5 w-2.5 rotate-45 bg-accent" />
          <UdmurtStar size={20} />
          <span className="block h-2.5 w-2.5 rotate-45 bg-accent" />
          <UdmurtStar size={16} />
          <span className="h-px flex-1 bg-border-strong" />
        </div>
      ) : null}
      {showNeutral ? (
        <div
          className={`h-5 w-full items-center gap-3 ${
            explicit === null ? "d06-neutral-only" : "flex"
          }`}
        >
          <span className="h-px flex-1 bg-border-subtle" />
          <span className="block h-2 w-2 rotate-45 bg-accent" />
          <span className="h-px flex-1 bg-border-subtle" />
        </div>
      ) : null}
    </div>
  );
}
