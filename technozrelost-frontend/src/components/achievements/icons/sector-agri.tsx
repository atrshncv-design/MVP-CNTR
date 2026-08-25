// sector-agri — Сельское хозяйство (sector, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SectorAgriIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-fg)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 20V10" /><path d="M12 16.4L9.8 15.5" /><path d="M12 13.8L9.8 12.9" /><path d="M12 11.2L10 10.3" /><path d="M12 16.4l2.2-.9" /><path d="M12 13.8l2.2-.9" /><path d="M12 11.2l2-.9" /><path d="M12 10V7.8" /><path d="M12.00 4.60L12.33 5.37L13.10 5.70L12.33 6.03L12.00 6.80L11.67 6.03L10.90 5.70L11.67 5.37Z" fill="var(--tz-accent)" stroke="none" />
    </svg>
  );
}
