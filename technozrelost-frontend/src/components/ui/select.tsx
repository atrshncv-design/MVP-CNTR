"use client";

import * as React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, children, id, ...props }: SelectProps) {
  const autoId = React.useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;
  const hasError = Boolean(error);
  return (
    <label className="block" htmlFor={selectId}>
      {label ? <span className="tz-label">{label}</span> : null}
      <select
        id={selectId}
        className={["tz-select", className].filter(Boolean).join(" ")}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
      {hasError ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-tz-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
