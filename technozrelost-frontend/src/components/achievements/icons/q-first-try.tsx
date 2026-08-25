// q-first-try — С первой попытки (переход без отклонений) (quality, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function QFirstTryIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="7.1" /><circle cx="12" cy="12" r="4.7" /><circle cx="12" cy="12" r="2.2" /><path d="M17.4 6.6L12.6 11.4" /><circle cx="12" cy="12" r="0.9" fill="var(--tz-success)" stroke="none" />
    </svg>
  );
}
