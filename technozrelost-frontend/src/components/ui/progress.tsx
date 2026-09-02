"use client";

import * as React from "react";

export function Progress({ value, className, "aria-label": ariaLabel, ...props }: { value: number; "aria-label"?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={["tz-progress", className].filter(Boolean).join(" ")}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `Прогресс ${v}%`}
      {...props}
    >
      <div className="tz-progress-fill" style={{ width: `${v}%` }} />
    </div>
  );
}

export function UgtProgress({ current, target, className, ...props }: { current: number; target: number } & React.HTMLAttributes<HTMLDivElement>) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return <Progress value={pct} className={className} {...props} />;
}
