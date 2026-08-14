// proj-ugt3 — Проект достиг УГТ 3 (project, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function ProjUgt3Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-fg)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5.8 17.2v-4.6" /><path d="M12 17.2v-7.2" /><path d="M18.2 17.2V7.4" /><path d="M4.6 17.2h14.8" />
    </svg>
  );
}
