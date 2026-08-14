// m-30-medals — Ветеран платформы — 30 медалей (member, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function M30MedalsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--medal-member)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12.4" r="6.4" /><path d="M8.4 17.7l-1.1 2.8" /><path d="M12 17.9v2.8" /><path d="M15.6 17.7l1.1 2.8" /><circle cx="12" cy="12.4" r="3.6" /><path d="M12.00 10.90L12.45 11.95L13.50 12.40L12.45 12.85L12.00 13.90L11.55 12.85L10.50 12.40L11.55 11.95Z" fill="var(--medal-member)" stroke="none" />
    </svg>
  );
}
