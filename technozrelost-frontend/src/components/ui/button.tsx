"use client";

import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Кнопка на токенах --tz-* (без инлайн-hex).
 * Почему .tz-btn: единый дизайн-система красная, 3.1 — все кнопки через этот класс.
 */
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }: ButtonProps) {
  const variantCls =
    variant === "primary"
      ? "tz-btn-primary"
      : variant === "secondary"
        ? "tz-btn-secondary"
        : variant === "danger"
          ? "tz-btn-danger"
          : "tz-btn-ghost";
  const sizeCls = size === "sm" ? "tz-btn-sm" : size === "lg" ? "tz-btn-lg" : "";
  const cls = ["tz-btn", variantCls, sizeCls, className].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
