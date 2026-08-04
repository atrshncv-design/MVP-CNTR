"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Status = "idle" | "loading" | "error";

const fieldClassName =
  "w-full rounded-lg border border-slate-300 bg-tz-surface px-4 py-3 text-tz-fg outline-none transition placeholder:text-tz-secondary focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20";
const PUBLIC_REGISTRATION_ROLES = ROLES.filter((role) => !role.slug.startsWith("cntr_"));

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    organization: "",
    role_slug: "gk_customer",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          organization: form.organization || null,
          role_slug: form.role_slug,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus("error");
        setError(data?.detail ?? "Не удалось зарегистрироваться");
        return;
      }

      router.push("/login");
    } catch {
      setStatus("error");
      setError("Сервис регистрации временно недоступен");
    }
  }

  return (
    <main className="grid min-h-screen bg-tz-bg lg:grid-cols-[1.1fr_0.9fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-14 text-white lg:flex lg:flex-col"
        style={{ background: "var(--tz-hero-bg)" }}
      >
        <div className="text-lg font-extrabold tracking-[0.08em]">ТЕХНОЗРЕЛОСТЬ</div>
        <div className="mt-1 font-mono text-xs text-[color:var(--tz-hero-muted)]">ГОСТ Р 58048-2017</div>
        <div className="my-auto max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[#7196FF]">
            Единый рабочий контур ЦНТР
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.08] tracking-[-0.04em]">
            Подключите организацию к жизненному циклу проекта
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[color:var(--tz-hero-muted)]">
            Создайте рабочую учётную запись, чтобы вести проекты, оценивать УГТ и
            работать с документами в едином контуре.
          </p>
          <div className="mt-12 grid grid-cols-9 gap-2" aria-label="Шкала УГТ от 1 до 9">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
              <div
                key={level}
                className="border-t-4 border-[#2E5BFF] pt-2 font-mono text-xs text-[color:var(--tz-hero-muted)]"
              >
                УГТ {level}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-[color:var(--tz-hero-muted)]">Центр научно-технологического развития</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="font-extrabold tracking-[0.08em] text-tz-fg">ТЕХНОЗРЕЛОСТЬ</div>
            <div className="mt-1 font-mono text-xs text-tz-secondary">ГОСТ Р 58048-2017</div>
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-xl border border-[#2E5BFF]/20 bg-[#2E5BFF]/[0.08] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2E5BFF] font-mono text-sm font-bold text-white">
              01
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.08em] text-[#7196FF]">Заявка на доступ</p>
              <p className="mt-1 text-sm leading-relaxed text-tz-secondary">
                Заполните данные организации и выберите рабочую роль.
              </p>
            </div>
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-secondary">Новая учётная запись</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-tz-fg">Регистрация в платформе</h2>
          <p className="mt-3 text-tz-secondary">
            После регистрации вы сможете перейти к рабочему кабинету организации.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="full_name" className="mb-2 block text-sm font-semibold text-tz-fg">
                ФИО
              </label>
              <input
                id="full_name"
                name="full_name"
                autoComplete="name"
                required
                value={form.full_name}
                onChange={(event) => update("full_name", event.target.value)}
                className={fieldClassName}
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-tz-fg">
                Рабочий email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                className={fieldClassName}
                placeholder="name@company.ru"
              />
            </div>

            <div>
              <label htmlFor="organization" className="mb-2 block text-sm font-semibold text-tz-fg">
                Организация
              </label>
              <input
                id="organization"
                name="organization"
                value={form.organization}
                onChange={(event) => update("organization", event.target.value)}
                className={fieldClassName}
                placeholder="Название организации"
              />
            </div>

            <div>
              <label htmlFor="role_slug" className="mb-2 block text-sm font-semibold text-tz-fg">
                Рабочая роль
              </label>
              <select
                id="role_slug"
                name="role_slug"
                value={form.role_slug}
                onChange={(event) => update("role_slug", event.target.value)}
                className={fieldClassName}
              >
                {PUBLIC_REGISTRATION_ROLES.map((role) => (
                  <option key={role.slug} value={role.slug}>
                    {role.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-tz-secondary">
                Роль определяет доступные разделы рабочего кабинета.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-tz-fg">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                className={fieldClassName}
                placeholder="Не менее 8 символов"
              />
            </div>

            <p aria-live="polite" className="min-h-5 text-sm text-tz-danger">
              {status === "error" ? error : ""}
            </p>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-[#2E5BFF] px-4 py-3 font-bold text-white transition hover:bg-[#244BD9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E5BFF] disabled:cursor-wait disabled:opacity-60"
            >
              {status === "loading" ? "Создание учётной записи…" : "Создать учётную запись"}
            </button>
          </form>

          <p className="mt-7 text-sm text-tz-secondary">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-semibold text-[#7196FF] underline-offset-4 hover:underline">
              Войти в платформу
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}