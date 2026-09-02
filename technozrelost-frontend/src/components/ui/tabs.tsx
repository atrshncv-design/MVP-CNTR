"use client";

import * as React from "react";

export function Tabs({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["tz-tabs", className].filter(Boolean).join(" ")} role="tablist" {...props}>
      {children}
    </div>
  );
}

export function Tab({
  active,
  count,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number | string }) {
  const cls = ["tz-tab", active ? "tz-tab-active" : ""].filter(Boolean).join(" ");
  return (
    <button className={cls} role="tab" aria-selected={!!active} {...props}>
      {children}
      {count != null ? <span className="tz-tab-count">{count}</span> : null}
    </button>
  );
}
