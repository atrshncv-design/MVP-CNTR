const COLORS: Record<string, string> = {
  accent: "var(--tz-accent)",
  strong: "var(--tz-accent-strong)",
  white: "var(--tz-hero-fg)",
  graphite: "var(--tz-fg)",
};

export default function UdmurtStar({
  size = 48,
  color = "accent",
  className,
  opacity = 1,
}: {
  size?: number;
  color?: "accent" | "strong" | "white" | "graphite";
  className?: string;
  opacity?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 3 3"
      fill={COLORS[color]}
      style={{ opacity }}
      className={className}
      aria-hidden="true"
    >
      <path d="m1 0 2 2H0l2-2v3L0 1h3L1 3z" />
    </svg>
  );
}
