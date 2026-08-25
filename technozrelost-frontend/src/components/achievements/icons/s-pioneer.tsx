// s-pioneer — Первопроходец (первый проект в отрасли) (secret, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SPioneerIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12.3" r="6.6" /><path d="M12 8l1.4 3.3h-2.8Z" fill="var(--tz-secondary)" stroke="none" /><path d="M12 16.6l-1.4-3.3h2.8Z" /><circle cx="12" cy="12.3" r="0.7" />
    </svg>
  );
}
