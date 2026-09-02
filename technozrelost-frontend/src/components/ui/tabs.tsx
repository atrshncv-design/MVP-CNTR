"use client";

import * as React from "react";

/**
 * Tabs с клавиатурой: стрелки ← →, Home/End — roving tabindex, как требует WCAG.
 */
export function Tabs({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    if (tabs.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = tabs.indexOf(active as HTMLElement);
    if (idx === -1) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div
      ref={ref}
      className={["tz-tabs", className].filter(Boolean).join(" ")}
      role="tablist"
      onKeyDown={onKeyDown}
      {...props}
    >
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
    <button className={cls} role="tab" aria-selected={!!active} tabIndex={active ? 0 : -1} {...props}>
      {children}
      {count != null ? <span className="tz-tab-count">{count}</span> : null}
    </button>
  );
}
