// s-ghost — Призрак (путь 1→9 без единого возврата) (secret, legendary)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SGhostIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M7.6 12.4a4.4 4.4 0 0 1 8.8 0V20l-1.7-1.2-2.7 1.6-2.7-1.6L7.6 20Z" /><circle cx="10.1" cy="12.8" r="0.75" fill="var(--tz-secondary)" stroke="none" /><circle cx="13.9" cy="12.8" r="0.75" fill="var(--tz-secondary)" stroke="none" />
    </svg>
  );
}
