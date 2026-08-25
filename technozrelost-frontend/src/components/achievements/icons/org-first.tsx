// org-first — Первый проект организации (organization, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function OrgFirstIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5.8 19.6V8.9L12 5l6.2 3.9v10.7" /><path d="M10.2 19.6v-3.2h3.6v3.2" /><path d="M12.00 1.90L12.36 2.74L13.20 3.10L12.36 3.46L12.00 4.30L11.64 3.46L10.80 3.10L11.64 2.74Z" fill="var(--tz-neutral)" stroke="none" />
    </svg>
  );
}
