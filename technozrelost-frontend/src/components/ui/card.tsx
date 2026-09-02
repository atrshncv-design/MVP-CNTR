"use client";

import * as React from "react";

export function Card({ className, hover, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  const cls = ["tz-card", hover ? "tz-card-hover" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["border-b border-tz-border p-5", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["p-5", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["border-t border-tz-border p-5", className].filter(Boolean).join(" ")} {...props} />;
}
