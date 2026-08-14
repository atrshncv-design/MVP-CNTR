// org-ugt6 — Проект организации до УГТ 6+ (organization, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function OrgUgt6Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-neutral)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5.8 19.6V8.9L12 5l6.2 3.9v10.7" /><path d="M10.2 19.6v-3.2h3.6v3.2" /><path d="M16.2 16.6V9.2" /><path d="M14.6 11.1l1.6-2.1 1.6 2.1" /><path d="M15.2 13.2h2" /><path d="M15.2 15.4h2" />
    </svg>
  );
}
