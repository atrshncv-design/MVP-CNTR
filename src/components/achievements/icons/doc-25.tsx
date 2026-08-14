// doc-25 — Серьёзный вклад — 25 документов (documents, common)
// Ручная векторная графика: сетка 24×24, толщина линии 1.5–2, палитра tz.
import type { SVGProps } from "react";

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export function Doc25Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--medal-documents)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7.2 3.8H14.4L18.2 7.6V18.6a1.6 1.6 0 0 1-1.6 1.6H7.2a1.6 1.6 0 0 1-1.6-1.6V5.4a1.6 1.6 0 0 1 1.6-1.6Z" /><path d="M14.4 3.8V7.6H18.2" /><text x="12" y="12.2" textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize="6" fontWeight="700" fill="var(--medal-documents)" stroke="none">25</text>
    </svg>
  );
}
