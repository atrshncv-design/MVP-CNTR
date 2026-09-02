"use client";

import * as React from "react";
import { Search as SearchIcon } from "lucide-react";

export interface SearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onSearch?: (value: string) => void;
  label?: string;
}

/**
 * Поиск с доступностью: иконка aria-hidden, input с aria-label по умолчанию "Поиск",
 * либо видимый label если передан.
 */
export function Search({ className, onSearch, onChange, label, id, "aria-label": ariaLabel, ...props }: SearchProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };
  const a11yLabel = ariaLabel ?? label ?? "Поиск";
  return (
    <div className={["relative max-w-md", className].filter(Boolean).join(" ")}>
      {label ? (
        <label htmlFor={inputId} className="tz-label">
          {label}
        </label>
      ) : null}
      <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        aria-label={label ? undefined : a11yLabel}
        className="tz-input pl-10"
        onChange={handle}
        {...props}
      />
    </div>
  );
}
