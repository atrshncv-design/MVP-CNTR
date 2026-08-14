// q-fast-start — Быстрый старт (первый документ за N дней) (quality, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QFastStartIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M8.8 7.4l4.2 4.6-4.2 4.6" /><path d="M13.6 7.4l4.2 4.6-4.2 4.6" />
    </svg>
  );
}
