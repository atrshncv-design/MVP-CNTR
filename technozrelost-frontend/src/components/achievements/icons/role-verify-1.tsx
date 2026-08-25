// role-verify-1 — Первая верификация (role, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleVerify1Icon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="13.2" r="6.3" /><path d="M12 6.9V4.6" /><path d="M9.3 13.4l1.9 1.9 3.5-3.8" />
    </svg>
  );
}
