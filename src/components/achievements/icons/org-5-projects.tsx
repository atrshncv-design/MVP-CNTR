// org-5-projects — 5 проектов организации (organization, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function Org5ProjectsIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5.8 19.6V8.9L12 5l6.2 3.9v10.7" /><path d="M10.2 19.6v-3.2h3.6v3.2" /><circle cx="8.5" cy="11.6" r="0.9" fill="var(--tz-neutral)" stroke="none" /><circle cx="11" cy="11.6" r="0.9" fill="var(--tz-neutral)" stroke="none" /><circle cx="13.5" cy="11.6" r="0.9" fill="var(--tz-neutral)" stroke="none" /><circle cx="9.75" cy="14.4" r="0.9" fill="var(--tz-neutral)" stroke="none" /><circle cx="12.25" cy="14.4" r="0.9" fill="var(--tz-neutral)" stroke="none" />
    </svg>
  );
}
