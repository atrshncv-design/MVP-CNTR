"use client";

import * as React from "react";

export function Progress({ value, className, ...props }: { value: number } & React.HTMLAttributes<HTMLDivElement>) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={["tz-progress", className].filter(Boolean).join(" ")} {...props}>
      <div className="tz-progress-fill" style={{ width: `${v}%` }} />
    </div>
  );
}

export function UgtProgress({ current, target, className, ...props }: { current: number; target: number } & React.HTMLAttributes<HTMLDivElement>) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return <Progress value={pct} className={className} {...props} />;
}
