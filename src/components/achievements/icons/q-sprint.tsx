// q-sprint — Спринтер (быстрый переход между уровнями) (quality, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QSprintIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-success)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M13.1 4.2L7 13.3h4.2L10.1 19.8l6.3-9.1h-4.2Z" />
    </svg>
  );
}
