"use client";

import * as React from "react";

export function Avatar({ name, className, ...props }: { name: string } & React.HTMLAttributes<HTMLDivElement>) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={["flex h-8 w-8 items-center justify-center rounded-full bg-tz-accent text-sm font-bold text-white", className].filter(Boolean).join(" ")}
      {...props}
    >
      {letter}
    </div>
  );
}
