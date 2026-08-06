/**
 * T-013. Переиспользуемые контролы auth-форм (login, register/*,
 * forgot/reset-password): label + подсказка «почему поле нужно» +
 * ошибка на уровне поля. Тач-цели ≥44px (Design.md §16), ошибки
 * привязаны к полям через aria-describedby и role="alert".
 */

"use client";

import { AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { useState } from "react";

export const authInputClasses =
  "h-11 w-full rounded-control border border-border-subtle bg-canvas px-3 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring";

/** Ошибка поля (role="alert", привязана через aria-describedby). */
export function FieldError({
  id,
  message,
}: {
  id?: string;
  message?: string | null;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-status-danger"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Подсказка под полем («почему мы спрашиваем»). */
export function FieldHint({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-meta leading-relaxed text-muted">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

interface FieldWrapProps {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  hintId?: string;
  errorId?: string;
  children: (ids: { describedBy?: string }) => React.ReactNode;
}

/** Обёртка поля: label + hint + контрол + ошибка. */
export function FieldWrap({
  label,
  required = false,
  hint,
  error,
  hintId,
  errorId,
  children,
}: FieldWrapProps) {
  const describedBy = [error ? errorId : undefined, hint ? hintId : undefined]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label
        htmlFor={undefined}
        className="block text-small font-semibold text-primary"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-status-danger" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 font-normal text-muted">(необязательно)</span>
        )}
      </label>
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      <div className="mt-2.5">{children({ describedBy: describedBy || undefined })}</div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

interface TextInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "url";
  maxLength?: number;
  describedBy?: string;
}

export function TextInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  describedBy,
}: TextInputProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={maxLength}
      aria-describedby={describedBy}
      className={authInputClasses}
    />
  );
}

interface SelectInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: readonly { id: string; label: string; hint?: string }[];
  placeholder?: string;
  describedBy?: string;
}

export function SelectInput({
  id,
  value,
  onChange,
  onBlur,
  options,
  placeholder = "Выберите…",
  describedBy,
}: SelectInputProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      aria-describedby={describedBy}
      className={`${authInputClasses} appearance-none bg-no-repeat pr-9`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoComplete?: string;
  describedBy?: string;
}

export function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  describedBy,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        className={`${authInputClasses} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex h-11 w-11 items-center justify-center rounded-r-control text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

interface CheckboxFieldProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
  errorId?: string;
  describedBy?: string;
  children: React.ReactNode;
}

export function CheckboxField({
  id,
  checked,
  onChange,
  error,
  errorId,
  describedBy,
  children,
}: CheckboxFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 rounded-control p-1"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={describedBy}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-small leading-relaxed text-secondary">
          {children}
        </span>
      </label>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
