/**
 * T-013. Индикатор прогресса пятишаговой регистрации (Design.md §14):
 * «Шаг N из 5», прогресс-бар, кликабельные пройденные шаги (навигация
 * назад — ввод сохранён в черновике). Текущий шаг подсвечен, будущие —
 * «впереди». На мобильном подписи скрываются, остаются номера.
 */

"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  REGISTRATION_STEPS,
  type RegistrationStepId,
} from "@/lib/registration";

export interface RegistrationProgressProps {
  current: RegistrationStepId;
  /** Кликабельны ли пройденные шаги (на pending — нет). */
  navigable?: boolean;
}

export function RegistrationProgress({
  current,
  navigable = true,
}: RegistrationProgressProps) {
  const currentIndex = REGISTRATION_STEPS.findIndex(
    (step) => step.id === current,
  );
  const percent = Math.round(((currentIndex + 1) / REGISTRATION_STEPS.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta font-medium text-muted">
          Шаг {currentIndex + 1} из {REGISTRATION_STEPS.length}
        </p>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={REGISTRATION_STEPS.length}
          aria-valuenow={currentIndex + 1}
          aria-label="Прогресс регистрации"
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ol className="mt-4 flex flex-wrap gap-1.5">
        {REGISTRATION_STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const done = index < currentIndex;
          const inner = (
            <>
              {done ? (
                <Check className="h-3.5 w-3.5 text-status-success" aria-hidden />
              ) : (
                <span className="font-mono">{index + 1}</span>
              )}
              <span className="hidden sm:inline">{step.short}</span>
            </>
          );
          const classes = [
            "inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-meta font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
            isCurrent
              ? "bg-accent-soft text-accent"
              : done
                ? "text-secondary hover:bg-surface"
                : "text-muted",
          ].join(" ");
          return (
            <li key={step.id}>
              {navigable && done ? (
                <Link
                  href={step.href}
                  aria-current={isCurrent ? "step" : undefined}
                  className={classes}
                >
                  {inner}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={classes}
                >
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
