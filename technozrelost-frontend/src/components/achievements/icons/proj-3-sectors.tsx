// proj-3-sectors — Полиглот отраслей (команда в 3+ отраслях) (project, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function Proj3SectorsIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M7.8 14.9L11.3 8.9" /><path d="M12.7 8.9L16.2 14.9" /><path d="M7.8 15.6H16.2" /><circle cx="7.8" cy="15.6" r="1.35" fill="var(--tz-fg)" stroke="none" /><circle cx="12" cy="7.8" r="1.35" fill="var(--tz-fg)" stroke="none" /><circle cx="16.2" cy="15.6" r="1.35" fill="var(--tz-fg)" stroke="none" />
    </svg>
  );
}
