"use client";

import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const autoId = React.useId();
  const tid = id ?? autoId;
  return (
    <label className="block">
      {label ? <span className="tz-label">{label}</span> : null}
      <textarea id={tid} className={["tz-textarea", className].filter(Boolean).join(" ")} {...props} />
      {error ? <span className="mt-1 block text-xs text-tz-danger">{error}</span> : null}
    </label>
  );
}
