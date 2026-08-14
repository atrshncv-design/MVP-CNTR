// org-10-docs — 10 документов организации (organization, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function Org10DocsIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5.8 19.6V8.9L12 5l6.2 3.9v10.7" /><path d="M10.2 19.6v-3.2h3.6v3.2" /><path d="M15.6 9.4h3.6v6.2a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1Z" /><path d="M16.8 11.6h1.6" /><path d="M16.8 13.2h1.6" />
    </svg>
  );
}
