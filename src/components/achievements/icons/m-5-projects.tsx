// m-5-projects — Вклад в 5+ проектов (member, epic)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function M5ProjectsIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 7.4l4.6 2.7-1.8 5.2H9.2L7.4 10.1Z" /><circle cx="12" cy="7.4" r="1.1" fill="var(--medal-member)" stroke="none" /><circle cx="16.6" cy="10.1" r="1.1" fill="var(--medal-member)" stroke="none" /><circle cx="14.8" cy="15.3" r="1.1" fill="var(--medal-member)" stroke="none" /><circle cx="9.2" cy="15.3" r="1.1" fill="var(--medal-member)" stroke="none" /><circle cx="7.4" cy="10.1" r="1.1" fill="var(--medal-member)" stroke="none" />
    </svg>
  );
}
