"use client";

import * as React from "react";

export function Chip({ active, className, type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const cls = ["tz-chip", active ? "tz-chip-active" : "", className].filter(Boolean).join(" ");
  return <button type={type} className={cls} aria-pressed={active} {...props} />;
}
