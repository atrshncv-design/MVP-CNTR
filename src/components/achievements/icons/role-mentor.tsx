// role-mentor — Наставник (команда дошла до УГТ 4+) (role, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleMentorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-warning)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="11.4" cy="7.6" r="2" /><path d="M7 18.2c0-3 2-4.6 4.4-4.6s4.4 1.6 4.4 4.6" /><path d="M17.60 5.65L17.94 6.46L18.75 6.80L17.94 7.14L17.60 7.95L17.26 7.14L16.45 6.80L17.26 6.46Z" fill="var(--tz-warning)" stroke="none" />
    </svg>
  );
}
