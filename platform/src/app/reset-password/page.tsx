/**
 * T-013. Сброс пароля (/reset-password, ROUTES.md).
 * Состояния: invalid token (нет/неверный токен) → success (пароль изменён)
 * → error. Валидный демо-токен — строка вида demo-*; в P0 пароль не
 * персистится (mock), экран фиксирует завершение сценария.
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  FieldWrap,
  PasswordInput,
} from "@/components/auth/form-controls";
import { validatePassword, validatePasswordConfirm } from "@/lib/registration";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState(false);

  const passwordError = touched.password ? validatePassword(password) : null;
  const confirmError = touched.passwordConfirm
    ? validatePasswordConfirm(passwordConfirm, password)
    : null;

  /* Mock-токены: валидна строка вида demo-*. Токен expired — невалиден. */
  const tokenValid = /^demo-/.test(token);

  if (!token || !tokenValid) {
    return (
      <AuthShell
        title="Ссылка недействительна"
        subtitle="Срок действия ссылки истёк, либо ссылка повреждена."
        backHref="/"
        backLabel="На главную"
      >
        <div className="text-center">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-status-warning-soft"
            aria-hidden
          >
            <ShieldAlert className="h-7 w-7 text-status-warning" />
          </span>
          <p className="mt-4 text-small leading-relaxed text-secondary">
            Запросите новую ссылку для восстановления пароля — предыдущая
            будет отозвана.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Запросить новую ссылку
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-4 text-meta text-muted">
            Демо-режим: валидный токен — /reset-password?token=demo-123456
          </p>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell
        title="Пароль изменён"
        subtitle="Новый пароль сохранён — можно входить в платформу."
        backHref="/"
        backLabel="На главную"
      >
        <div className="text-center">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-status-success-soft"
            aria-hidden
          >
            <CheckCircle2 className="h-7 w-7 text-status-success" />
          </span>
          <h2 className="mt-4 text-h3 font-semibold tracking-tight text-primary">
            Готово
          </h2>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Пароль от аккаунта обновлён. Войдите с новым паролем — старые
            сессии будут завершены.
          </p>
          <button
            type="button"
            onClick={() => {
              router.push("/login");
              router.refresh();
            }}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Войти
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ password: true, passwordConfirm: true });
    if (passwordError || confirmError) return;
    setSuccess(true);
  };

  return (
    <AuthShell
      title="Новый пароль"
      subtitle={
        <>
          Придумайте новый пароль для аккаунта. Вспомнили старый?{" "}
          <Link
            href="/login"
            className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Войти
          </Link>
        </>
      }
      backHref="/"
      backLabel="На главную"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="flex items-center gap-2 rounded-control border border-border-subtle bg-canvas/60 px-3.5 py-2.5 text-meta text-muted">
          <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Токен действителен: <span className="font-mono text-primary">…{token.slice(-6)}</span>
        </div>

        <FieldWrap
          label="Новый пароль"
          required
          hint="Минимум 8 символов, хотя бы одна буква и одна цифра."
          hintId="reset-password-hint"
          error={passwordError}
          errorId="reset-password-error"
        >
          {({ describedBy }) => (
            <PasswordInput
              id="reset-password"
              value={password}
              onChange={(value) => setPassword(value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              autoComplete="new-password"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <FieldWrap
          label="Повторите новый пароль"
          required
          hint="Повтор нужен, чтобы исключить опечатку."
          hintId="reset-password2-hint"
          error={confirmError}
          errorId="reset-password2-error"
        >
          {({ describedBy }) => (
            <PasswordInput
              id="reset-password2"
              value={passwordConfirm}
              onChange={(value) => setPasswordConfirm(value)}
              onBlur={() =>
                setTouched((prev) => ({ ...prev, passwordConfirm: true }))
              }
              autoComplete="new-password"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent-strong text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Сохранить новый пароль
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
          <p role="status" className="text-small text-muted">
            Проверяем ссылку…
          </p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
