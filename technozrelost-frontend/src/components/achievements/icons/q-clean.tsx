// q-clean — Чистый проект (без возвратов до УГТ 4) (quality, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QCleanIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 4.3l6 2.2v4.9c0 3.8-2.5 7-6 8.6-3.5-1.6-6-4.8-6-8.6V6.5Z" /><path d="M9.2 11.7l2 2.1 3.6-3.9" />
    </svg>
  );
}
