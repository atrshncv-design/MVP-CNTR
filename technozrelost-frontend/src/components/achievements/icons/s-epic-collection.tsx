// s-epic-collection — Эпическая коллекция (все 9 УГТ-медалей) (secret, legendary)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

export function SEpicCollectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-secondary)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="18.2" cy="12" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="16.4" cy="16.4" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="12" cy="18.2" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="7.6" cy="16.4" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="5.8" cy="12" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="7.6" cy="7.6" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="12" cy="5.8" r="1.05" fill="var(--tz-secondary)" stroke="none" /><circle cx="16.4" cy="7.6" r="1.05" fill="var(--tz-secondary)" stroke="none" /><path d="M12.00 10.40L12.48 11.52L13.60 12.00L12.48 12.48L12.00 13.60L11.52 12.48L10.40 12.00L11.52 11.52Z" fill="var(--tz-secondary)" stroke="none" />
    </svg>
  );
}
