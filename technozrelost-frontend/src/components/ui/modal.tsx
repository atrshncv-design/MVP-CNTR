"use client";

import * as React from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tz-fg/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tz-card max-h-[85vh] w-full max-w-lg overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-tz-border p-5">
          {title ? <h2 className="tz-card-title">{title}</h2> : <span />}
          <button onClick={onClose} aria-label="Закрыть" className="tz-btn tz-btn-ghost tz-btn-sm">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
