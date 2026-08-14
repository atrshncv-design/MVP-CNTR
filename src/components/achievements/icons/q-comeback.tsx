// q-comeback — Возвращение (откат → снова УГТ 7+) (quality, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QComebackIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6.4 7.4v5.4a5.6 5.6 0 0 0 11.2 0V9.6" /><path d="M15.7 11.3l1.9-1.7 1.6 2.1" />
    </svg>
  );
}
