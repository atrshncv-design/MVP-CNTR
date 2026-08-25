// role-verify-50 — Мастер верификации — 50 переходов (role, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function RoleVerify50Icon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="13.2" r="6.3" /><path d="M12 6.9V4.6" /><path d="M12.00 11.85L12.40 12.80L13.35 13.20L12.40 13.60L12.00 14.55L11.60 13.60L10.65 13.20L11.60 12.80Z" fill="var(--tz-warning)" stroke="none" />
    </svg>
  );
}
