"use client";

import * as React from "react";

/**
 * Тултип с доступностью: мышь + клавиатура + скринридер.
 * Почему: axe ругается на tooltip без role и без клавиатурного доступа,
 * контент должен быть связан через aria-describedby и показываться на focus.
 */
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      // фокус пузырьком от внутреннего интерактивного элемента — клавиатурный доступ без лишнего tabIndex
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-tz-fg px-2 py-1 text-xs text-white shadow-tz-pop"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
