// q-marathon — Марафонец (проект в работе более года) (quality, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QMarathonIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12.9" r="6.6" /><path d="M12 6.3V4.5" /><path d="M16.2 6.4l1.1-1.1" /><path d="M12 12.9V9.8" /><path d="M12 12.9l2.1 1.3" />
    </svg>
  );
}
