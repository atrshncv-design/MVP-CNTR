// s-comet — Комета (рекордное время 1→9) (secret, legendary)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SCometIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-secondary)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="14.7" cy="7.9" r="2.6" /><path d="M12.7 9.8c-2 1.9-4 3.7-6.7 5.7" /><path d="M12.2 10.7c-1.6 1.6-3.2 3-5.4 4.4" />
    </svg>
  );
}
