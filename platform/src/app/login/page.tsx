/**
 * T-013. Вход в платформу (ROUTES.md: /login).
 *
 * Состояния: initial → validation error (field-level) → invalid credentials
 * (баннер) / locked (блокировка после 5 неудачных попыток) → success
 * (редирект в кабинет: участник → /app, роль Центра → /operations).
 *
 * Демо-доступ для проверки интерфейса сохранён отдельным блоком ниже формы
 * (роль-свитчер из T-003 + таблица демо-аккаунтов): P0 — mock-авторизация,
 * реальный auth (NextAuth) — на интеграции.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FlaskConical, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  FieldWrap,
  PasswordInput,
  TextInput,
} from "@/components/auth/form-controls";
import {
  BACKEND_ROLES,
  getRoleDefinition,
  type BackendRoleId,
} from "@/lib/roles";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  getMockSession,
  getSessionHome,
  setMockRole,
  signIn,
  type SignInResult,
} from "@/lib/session";

type FormState = "initial" | "validation" | "invalid" | "locked" | "success";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "danger" | "warning"; text: string } | null>(null);
  const [state, setState] = useState<FormState>("initial");
  const [submitting, setSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  /* Уже вошли — сразу в кабинет (без мигания формы). */
  useEffect(() => {
    const session = getMockSession();
    if (session) {
      router.replace(getSessionHome(session.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): boolean => {
    const e = email.trim();
    const emailErr = !e
      ? "Укажите email — он используется для входа."
      : !EMAIL_RE.test(e)
        ? "Похоже, в адресе опечатка. Пример: ivan@company.ru"
        : null;
    const passErr = password === "" ? "Введите пароль." : null;
    setEmailError(emailErr);
    setPasswordError(passErr);
    return emailErr === null && passErr === null;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setBanner(null);
    if (!validate()) {
      setState("validation");
      return;
    }
    setSubmitting(true);
    const result: SignInResult = signIn(email, password);
    setSubmitting(false);
    if (result.ok) {
      setState("success");
      router.push(result.home);
      router.refresh();
      return;
    }
    if (result.error === "locked") {
      setState("locked");
      setRetryAfter(result.retryAfterSeconds ?? 60);
      setBanner({
        tone: "warning",
        text: result.message,
      });
      return;
    }
    setState("invalid");
    setBanner({ tone: "danger", text: result.message });
  };

  /* Обратный отсчёт блокировки. */
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter((seconds) => {
        if (seconds === null || seconds <= 1) {
          window.clearInterval(timer);
          setBanner(null);
          setState("initial");
          return null;
        }
        setBanner({
          tone: "warning",
          text: `Слишком много неудачных попыток входа. Повторите через ${seconds - 1} сек.`,
        });
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  const quickEnter = (id: BackendRoleId) => {
    setMockRole(id);
    router.push(getSessionHome(id));
    router.refresh();
  };

  const demoHome = (id: BackendRoleId) => getSessionHome(id);

  return (
    <AuthShell
      title="Вход в платформу"
      subtitle={
        <>
          Доступ к кабинету участника или операционному центру. Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Зарегистрируйтесь
          </Link>
        </>
      }
      backHref="/"
      backLabel="На главную"
    >
      {banner ? (
        <div
          ref={bannerRef}
          role="alert"
          aria-live="assertive"
          className={`mb-5 flex items-start gap-2.5 rounded-control border p-3.5 text-small leading-relaxed ${
            banner.tone === "danger"
              ? "border-status-danger/40 bg-status-danger-soft text-status-danger"
              : "border-status-warning/40 bg-status-warning-soft text-status-warning"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {banner.text}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FieldWrap
          label="Email"
          required
          hint="Адрес, на который зарегистрирован аккаунт."
          hintId="login-email-hint"
          error={emailError}
          errorId="login-email-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="login-email"
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                if (emailError) setEmailError(null);
                if (banner) setBanner(null);
              }}
              placeholder="you@company.ru"
              autoComplete="email"
              inputMode="email"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <FieldWrap
          label="Пароль"
          required
          hint="Пароль от аккаунта платформы."
          hintId="login-password-hint"
          error={passwordError}
          errorId="login-password-error"
        >
          {({ describedBy }) => (
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError(null);
                if (banner) setBanner(null);
              }}
              autoComplete="current-password"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <div className="flex items-center justify-between gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex h-10 items-center text-small font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Забыли пароль?
          </Link>
          <span className="text-meta text-muted">
            <KeyRound className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Доступ защищён
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting || state === "locked"}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent-strong text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Проверяем данные…" : "Войти"}
          {!submitting ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </button>
      </form>

      {/* Демо-доступ для проверки интерфейса (T-003 роль-свитчер + аккаунты) */}
      <section
        aria-label="Демо-доступ для проверки интерфейса"
        className="mt-8 border-t border-border-subtle pt-6"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted" aria-hidden />
          <h2 className="text-small font-semibold text-primary">
            Демо-доступ для проверки интерфейса
          </h2>
          <span className="rounded-[4px] bg-accent-soft px-1.5 py-0.5 text-meta font-medium text-accent">
            dev
          </span>
        </div>
        <p className="mt-1.5 text-meta leading-relaxed text-muted">
          P0 работает на mock-авторизации: демо-аккаунты зеркалят бэкенд,
          пароль у всех — <span className="font-mono text-primary">{DEMO_PASSWORD}</span>.
          Реальный вход (NextAuth) появится на этапе интеграции.
        </p>

        <ul className="mt-4 space-y-2" role="list">
          {DEMO_ACCOUNTS.map((account) => {
            const definition = getRoleDefinition(account.role);
            return (
              <li key={account.email} role="listitem">
                <button
                  type="button"
                  onClick={() => quickEnter(account.role)}
                  className="group flex w-full items-center gap-3 rounded-control border border-border-subtle bg-canvas/60 px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"
                    aria-hidden
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-primary">
                      {definition?.label}
                    </span>
                    <span className="block truncate font-mono text-meta text-muted">
                      {account.email}
                    </span>
                  </span>
                  <span className="hidden text-meta text-muted sm:block">
                    → {demoHome(account.role)}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {/* Быстрый вход через роль-свитчер (все роли, включая научные) */}
        <div className="mt-4 flex flex-col gap-2 rounded-control border border-dashed border-border-strong bg-canvas/60 p-3 sm:flex-row sm:items-center">
          <label htmlFor="demo-role-select" className="text-small text-secondary">
            Или выберите роль напрямую:
          </label>
          <div className="flex flex-1 gap-2">
            <select
              id="demo-role-select"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) quickEnter(event.target.value as BackendRoleId);
              }}
              className="h-11 min-w-0 flex-1 rounded-control border border-border-subtle bg-surface px-2.5 text-small text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <option value="">Выберите роль…</option>
              {BACKEND_ROLES.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label} · {role.demoEmail}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-meta leading-relaxed text-muted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Демо-аккаунты не содержат реальных данных. После одобрения заявки на
          регистрацию вход будет выполняться обычной формой выше.
        </p>
      </section>
    </AuthShell>
  );
}
