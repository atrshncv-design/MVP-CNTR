// role-verify-10 — Опытный верификатор — 10 переходов (role, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleVerify10Icon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="13.2" r="6.3" /><circle cx="12" cy="13.2" r="4.2" /><path d="M12 6.9V4.6" /><path d="M9.7 13.4l1.6 1.6 3-3.2" />
    </svg>
  );
}
