"use client";

import * as React from "react";

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open ? (
        <span className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-tz-fg px-2 py-1 text-xs text-white shadow-tz-pop">
          {content}
        </span>
      ) : null}
    </span>
  );
}
