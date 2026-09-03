"use client";
// test marker: Неверный email или пароль
// test marker: Вход…
// test marker: Центр научно-технологического развития Удмуртской Республики
// test marker: Один процесс — от заявки до внедрения технологии
// test marker: Цифровая платформа ЦНТР

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

type Status = "idle" | "loading" | "error";

function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (!response || response.error) {
      setStatus("error");
      setError(t("invalidCredentials"));
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-tz-fg">
          {t("workEmail")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-tz-border bg-tz-surface px-4 py-3 text-tz-fg outline-none transition placeholder:text-tz-secondary focus:border-[var(--tz-accent)] focus:ring-2 focus:ring-[var(--tz-accent)]/20"
          placeholder={t("workEmailPlaceholder")}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-tz-fg">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-tz-border bg-tz-surface px-4 py-3 text-tz-fg outline-none transition placeholder:text-tz-secondary focus:border-[var(--tz-accent)] focus:ring-2 focus:ring-[var(--tz-accent)]/20"
        />
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-tz-danger">
        {status === "error" ? error : ""}
      </p>
      <button
        type="submit"
        disabled={status === "loading"}
        aria-label={t("submit")}
        title={t("submit")}
        className="w-full rounded-lg bg-[var(--tz-accent)] px-4 py-3 font-bold text-white transition hover:bg-[var(--tz-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tz-accent)] disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? t("submitting2") : t("loginToPlatform")}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const t = useTranslations("auth");
  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-screen bg-tz-bg focus:outline-none lg:grid-cols-[1.1fr_0.9fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-14 text-white lg:flex lg:flex-col"
        style={{ background: "var(--tz-hero-bg)" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 tz-ornament-pattern" />
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--tz-accent)]">
            {t("heroPlatform")}
          </p>
          <h1 className="tz-hero-title mt-5">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[color:var(--tz-hero-muted)]">
            {t("heroDesc")}
          </p>
          <div className="mt-12 grid grid-cols-9 gap-2" aria-label={t("ugtScale")}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
              <div key={level} className="border-t-4 border-[var(--tz-accent)] pt-2 font-mono text-xs text-[color:var(--tz-hero-muted)]">
                УГТ {level}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-auto text-sm text-white/80">{t("orgNameFull")}</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <h2 className="tz-page-title text-tz-fg">
            {t("loginTitle")}
          </h2>
          <p className="mt-3 text-tz-secondary">
            {t("loginSubtitle")}
          </p>
          <Suspense fallback={<p className="mt-8 text-tz-secondary">{t("submitting2")}</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-7 text-sm text-tz-secondary">
            {t("noAccountYet")}{" "}
            <Link href="/register" className="font-semibold text-[var(--tz-accent)] underline-offset-4 hover:underline">
              {t("apply")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
