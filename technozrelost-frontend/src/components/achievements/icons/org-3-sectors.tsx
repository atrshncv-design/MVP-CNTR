// org-3-sectors — 3 отрасли организации (organization, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function Org3SectorsIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5.8 19.6V8.9L12 5l6.2 3.9v10.7" /><path d="M10.2 19.6v-3.2h3.6v3.2" /><circle cx="8.7" cy="12" r="0.9" fill="var(--tz-neutral)" stroke="none" /><circle cx="12" cy="12" r="0.9" fill="var(--tz-neutral)" stroke="none" /><circle cx="15.3" cy="12" r="0.9" fill="var(--tz-neutral)" stroke="none" />
    </svg>
  );
}
