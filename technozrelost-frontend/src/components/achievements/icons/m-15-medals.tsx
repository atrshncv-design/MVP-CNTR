// m-15-medals — Коллекционер опыта — 15 медалей (member, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export function M15MedalsIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12.4" r="6.4" /><path d="M8.4 17.7l-1.1 2.8" /><path d="M12 17.9v2.8" /><path d="M15.6 17.7l1.1 2.8" /><circle cx="12" cy="12.4" r="3.6" /><text x="12" y="12.4" textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize="4.2" fontWeight="700" fill="var(--medal-member)" stroke="none">15</text>
    </svg>
  );
}
