/**
 * T-013. Восстановление пароля (/forgot-password, ROUTES.md).
 * Состояния: initial → validation error → sent (инструкция на email;
 * в демо-режиме письма не отправляются — показана ссылка с токеном).
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FieldWrap, TextInput } from "@/components/auth/form-controls";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const e = email.trim();
    const error = !e
      ? "Укажите email — на него отправим ссылку для восстановления."
      : !EMAIL_RE.test(e)
        ? "Похоже, в адресе опечатка. Пример: ivan@company.ru"
        : null;
    setEmailError(error);
    if (error) return;
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title="Письмо отправлено"
        subtitle="Проверьте почту — ссылка для восстановления пароля действительна 24 часа."
        backHref="/"
        backLabel="На главную"
      >
        <div className="text-center">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-status-success-soft"
            aria-hidden
          >
            <MailCheck className="h-7 w-7 text-status-success" />
          </span>
          <h2 className="mt-4 text-h3 font-semibold tracking-tight text-primary">
            Проверьте {email.trim()}
          </h2>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Если аккаунт с таким адресом существует, мы отправили ссылку для
            сброса пароля. Если письма нет — проверьте папку «Спам».
          </p>

          <div className="mt-6 rounded-control border border-dashed border-border-strong bg-canvas/60 p-4 text-left">
            <p className="text-meta font-medium uppercase tracking-wider text-muted">
              Демо-режим
            </p>
            <p className="mt-1.5 text-meta leading-relaxed text-muted">
              Письма в P0 не отправляются. Откройте ссылку восстановления
              напрямую:
            </p>
            <Link
              href="/reset-password?token=demo-123456"
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-control border border-border-subtle bg-surface px-3 font-mono text-meta text-accent transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              /reset-password?token=demo-123456
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Вернуться ко входу
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Восстановление пароля"
      subtitle={
        <>
          Укажите email, на который зарегистрирован аккаунт. Вспомнили
          пароль?{" "}
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
        <FieldWrap
          label="Email"
          required
          hint="На этот адрес придёт ссылка для сброса пароля."
          hintId="forgot-email-hint"
          error={emailError}
          errorId="forgot-email-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="forgot-email"
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                if (emailError) setEmailError(null);
              }}
              placeholder="you@company.ru"
              autoComplete="email"
              inputMode="email"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent-strong text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Mail className="h-4 w-4" aria-hidden />
          Отправить ссылку для восстановления
        </button>
      </form>

      <p className="mt-5 flex items-start gap-2 text-meta leading-relaxed text-muted">
        <ArrowLeft className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Мы не сообщаем, существует ли аккаунт с указанным адресом — это защита
        от перебора адресов.
      </p>
    </AuthShell>
  );
}
