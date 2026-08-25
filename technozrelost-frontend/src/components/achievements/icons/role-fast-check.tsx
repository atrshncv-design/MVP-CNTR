// role-fast-check — Быстрая проверка (< 3 рабочих дней) (role, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleFastCheckIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="13" r="6.5" /><path d="M12 6.5V4.6" /><path d="M16 6.7l1-1" /><path d="M9.7 13.2l1.7 1.7 3.1-3.4" />
    </svg>
  );
}
