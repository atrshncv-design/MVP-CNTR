// s-phoenix — Феникс (дважды вернулся с УГТ 4+ → УГТ 7+) (secret, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SPhoenixIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 4.6c2 2.9 3.9 5.2 3.9 8.4a3.9 3.9 0 0 1-7.8 0c0-3.2 1.9-5.5 3.9-8.4Z" /><path d="M12 8.4c1.1 1.6 2 3 2 4.6a2 2 0 0 1-4 0c0-1.6.9-3 2-4.6Z" /><path d="M5.9 12.4c-1.6-1.5-1.7-3.7-.5-5.1" /><path d="M18.1 12.4c1.6-1.5 1.7-3.7.5-5.1" />
    </svg>
  );
}
