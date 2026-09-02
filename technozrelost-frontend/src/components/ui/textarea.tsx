"use client";

import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const autoId = React.useId();
  const tid = id ?? autoId;
  const errorId = `${tid}-error`;
  const hasError = Boolean(error);
  return (
    <label className="block" htmlFor={tid}>
      {label ? <span className="tz-label">{label}</span> : null}
      <textarea
        id={tid}
        className={["tz-textarea", className].filter(Boolean).join(" ")}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...props}
      />
      {hasError ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-tz-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
