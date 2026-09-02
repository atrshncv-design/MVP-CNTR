"use client";

import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label className="block">
      {label ? <span className="tz-label">{label}</span> : null}
      <input id={inputId} className={["tz-input", className].filter(Boolean).join(" ")} {...props} />
      {error ? <span className="mt-1 block text-xs text-tz-danger">{error}</span> : null}
    </label>
  );
}
