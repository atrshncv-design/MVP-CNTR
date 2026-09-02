"use client";

import * as React from "react";
import { Search as SearchIcon } from "lucide-react";

export interface SearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onSearch?: (value: string) => void;
}

export function Search({ className, onSearch, onChange, ...props }: SearchProps) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };
  return (
    <div className={["relative max-w-md", className].filter(Boolean).join(" ")}>
      <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" aria-hidden="true" />
      <input type="text" className="tz-input pl-10" onChange={handle} {...props} />
    </div>
  );
}
