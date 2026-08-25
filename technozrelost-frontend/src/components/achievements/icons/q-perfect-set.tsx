// q-perfect-set — Идеальный комплект (все документы с первой попытки) (quality, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QPerfectSetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-success)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7.2 3.8H14.4L18.2 7.6V18.6a1.6 1.6 0 0 1-1.6 1.6H7.2a1.6 1.6 0 0 1-1.6-1.6V5.4a1.6 1.6 0 0 1 1.6-1.6Z" /><path d="M14.4 3.8V7.6H18.2" /><path d="M9.1 12.2l2 2 3.6-3.8" /><path d="M15.90 5.05L16.21 5.79L16.95 6.10L16.21 6.41L15.90 7.15L15.59 6.41L14.85 6.10L15.59 5.79Z" fill="var(--tz-success)" stroke="none" />
    </svg>
  );
}
