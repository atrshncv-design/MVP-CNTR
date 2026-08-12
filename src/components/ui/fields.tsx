"use client";

/**
 * Единые компоненты форм (тикет 07 internal-ux-redesign).
 *
 * Гарантируют общий паттерн для всех форм внутреннего контура:
 * - <label htmlFor> + обязательные поля с маркером «*»;
 * - placeholder никогда не заменяет label;
 * - ошибки: <FieldError role="alert"> + aria-describedby на поле,
 *   aria-invalid на поле в состоянии ошибки;
 * - серверные ошибки: <FormAlert role="alert"> (единый вид).
 *
 * Стили — на токенах --tz-* (классы tz-label / tz-input / tz-input-error).
 */

import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Сообщение об ошибке поля (role="alert", id для aria-describedby)
   ──────────────────────────────────────────────────────────────────────── */
export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-sm text-tz-danger"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Блок-обёртка поля: label + children + подсказка + ошибка (aria-связки)
   ──────────────────────────────────────────────────────────────────────── */
interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
}

export function FieldShell({ label, htmlFor, required, error, hint, children }: FieldShellProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  return (
    <div>
      <label htmlFor={htmlFor} className="tz-label">
        {label}
        {required && (
          <span className="text-tz-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-tz-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={error ? errorId : undefined}>{error}</FieldError>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   TextField / SelectField / TextAreaField
   ──────────────────────────────────────────────────────────────────────── */

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function TextField({ label, error, hint, required, id, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={inputId} required={required} error={error} hint={hint}>
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${inputId}-error`
            : hint
              ? `${inputId}-hint`
              : undefined
        }
        className={`tz-input ${error ? "tz-input-error" : ""} ${className ?? ""}`}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function SelectField({ label, error, hint, required, id, className, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={selectId} required={required} error={error} hint={hint}>
      <select
        id={selectId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${selectId}-error`
            : hint
              ? `${selectId}-hint`
              : undefined
        }
        className={`tz-select ${error ? "tz-select-error" : ""} ${className ?? ""}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function TextAreaField({ label, error, hint, required, id, className, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={areaId} required={required} error={error} hint={hint}>
      <textarea
        id={areaId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${areaId}-error`
            : hint
              ? `${areaId}-hint`
              : undefined
        }
        className={`tz-textarea ${error ? "tz-textarea-error" : ""} ${className ?? ""}`}
        {...rest}
      />
    </FieldShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   FormAlert — серверная ошибка / успех формы (единый вид, role="alert")
   ──────────────────────────────────────────────────────────────────────── */
export function FormAlert({
  type = "error",
  children,
  id,
}: {
  type?: "error" | "success";
  children?: ReactNode;
  id?: string;
}) {
  if (!children) return null;
  if (type === "success") {
    return (
      <div
        id={id}
        role="status"
        className="flex items-start gap-2 rounded-xl border border-tz-success/30 bg-tz-success-soft px-3 py-2.5 text-sm text-tz-success"
      >
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{children}</span>
      </div>
    );
  }
  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-tz-danger/30 bg-tz-danger-soft px-3 py-2.5 text-sm text-tz-danger"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
