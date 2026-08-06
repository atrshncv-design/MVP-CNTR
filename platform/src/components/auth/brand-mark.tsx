/**
 * T-013. Знак Центра: восьмиконечная звезда (толязь) на акцентной плашке.
 * Общий для публичного header и auth-шелла.
 */
export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const icon = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span
      aria-hidden
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-control bg-accent-strong text-accent-contrast`}
    >
      <svg viewBox="0 0 24 24" className={icon} fill="currentColor">
        <path d="M12 1 14.2 9.8 23 12 14.2 14.2 12 23 9.8 14.2 1 12 9.8 9.8Z" />
      </svg>
    </span>
  );
}
