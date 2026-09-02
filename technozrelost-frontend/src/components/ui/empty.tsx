"use client";

import * as React from "react";

export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="tz-card tz-empty" role="status" aria-live="polite">
      {icon ? (
        <span className="tz-empty-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h2 className="tz-empty-title">{title}</h2>
      {description ? <p className="tz-empty-text">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
