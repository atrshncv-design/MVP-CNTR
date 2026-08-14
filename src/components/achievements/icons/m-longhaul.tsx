// m-longhaul — Долгожитель (в команде от УГТ 1 до УГТ 4+) (member, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function MLonghaulIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--medal-member)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="7.4" cy="7.6" r="1.8" /><path d="M4.6 17c0-2.5 1.3-3.9 2.8-3.9s2.8 1.4 2.8 3.9" /><path d="M10.4 16.4c2.1-1.9 4.4-1.5 6.9-3" strokeDasharray="2.4 1.6" /><path d="M17.3 13.4v-3.4" /><path d="M17.3 10.3l2.1 1-2.1 1Z" />
    </svg>
  );
}
