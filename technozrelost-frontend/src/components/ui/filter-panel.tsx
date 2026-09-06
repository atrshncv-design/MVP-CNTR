"use client";

import * as React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./button";

export function FilterPanel({
  children,
  onReset,
  hasFilters,
  className,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  hasFilters?: boolean;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  return (
    <div className={["flex flex-wrap items-center gap-2", className].filter(Boolean).join(" ")}>
      <Filter size={16} className="text-tz-muted" aria-hidden="true" />
      {children}
      {hasFilters && onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw size={12} aria-hidden="true" />
          {t("uiReset")}
        </Button>
      ) : null}
    </div>
  );
}

export function FilterChip({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const cls = ["tz-chip", active ? "tz-chip-active" : ""].filter(Boolean).join(" ");
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
