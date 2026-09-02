"use client";

import * as React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, children, id, ...props }: SelectProps) {
  const autoId = React.useId();
  const selectId = id ?? autoId;
  return (
    <label className="block">
      {label ? <span className="tz-label">{label}</span> : null}
      <select id={selectId} className={["tz-select", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-tz-danger">{error}</span> : null}
    </label>
  );
}
