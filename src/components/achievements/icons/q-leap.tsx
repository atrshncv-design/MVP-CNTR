// q-leap — Рывок (переход на 2+ уровня за цикл) (quality, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QLeapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-success)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3.8l3.9 6.1a4.8 4.8 0 0 1-7.8 0Z" /><circle cx="12" cy="9.6" r="1.4" /><path d="M10.9 12.2h2.2L12 14.4Z" />
    </svg>
  );
}
