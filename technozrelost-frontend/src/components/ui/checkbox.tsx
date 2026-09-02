"use client";

import * as React from "react";

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={["inline-flex items-center gap-2 text-sm text-tz-secondary", className].filter(Boolean).join(" ")}>
      <input type="checkbox" className="h-4 w-4 rounded border-tz-border bg-tz-surface text-tz-accent focus:ring-2 focus:ring-tz-accent-soft" {...props} />
      {label}
    </label>
  );
}
