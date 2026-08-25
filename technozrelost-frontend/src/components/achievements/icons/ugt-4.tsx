// ugt-4 — УГТ 4 — Прототип в лаборатории (ugt, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function Ugt4Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-ugt-4)"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.5 16.5A7.5 7.5 0 0 1 19.5 16.5" strokeOpacity={0.3} />
<path d="M6.2 16.5H4.5" />
<path d="M6.64 14.28L5.07 13.63" />
<path d="M7.9 12.4L6.7 11.2" />
<path d="M9.78 11.14L9.13 9.57" />
<path d="M12 10.7V9" stroke="var(--tz-border)" strokeOpacity={0.55} />
<path d="M14.22 11.14L14.87 9.57" stroke="var(--tz-border)" strokeOpacity={0.55} />
<path d="M16.1 12.4L17.3 11.2" stroke="var(--tz-border)" strokeOpacity={0.55} />
<path d="M17.36 14.28L18.93 13.63" stroke="var(--tz-border)" strokeOpacity={0.55} />
<path d="M17.8 16.5H19.5" stroke="var(--tz-border)" strokeOpacity={0.55} />
<path d="M12 16.5L10.24 12.25" strokeWidth={2} />
<circle cx="12" cy="16.5" r="1.15" fill="var(--tz-ugt-4)" stroke="none" />
    </svg>
  );
}
