"use client";

import * as React from "react";

type Variant = "neutral" | "success" | "warning" | "review" | "danger" | "accent";

export function Badge({ variant = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const map: Record<Variant, string> = {
    neutral: "tz-badge-neutral",
    success: "tz-badge-success",
    warning: "tz-badge-warning",
    review: "tz-badge-review",
    danger: "tz-badge-danger",
    accent: "tz-badge-accent",
  };
  const cls = ["tz-badge", map[variant], className].filter(Boolean).join(" ");
  return <span className={cls} {...props} />;
}

export function UgtBadge({ level, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { level: number }) {
  const lvl = Math.max(1, Math.min(9, level));
  const cls = ["tz-ugt", `tz-ugt-${lvl}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...props}>
      УГТ {lvl}
    </span>
  );
}

export function StatusBadge({ status, label, ...props }: { status: string; label?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  // цвет берём из статуса через CSS-переменные, без hex
  const variant: Variant =
    status === "completed" || status === "auto_confirmed"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "review"
          ? "review"
          : status === "draft" || status === "archived"
            ? "neutral"
            : "accent";
  return (
    <Badge variant={variant} {...props}>
      {label ?? status}
    </Badge>
  );
}
