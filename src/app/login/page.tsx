"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

type Status = "idle" | "loading" | "error";

function LoginForm() {
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
      setError("Неверный email или пароль");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
          Рабочий email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20"
          placeholder="name@company.ru"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20"
        />
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-red-700">
        {status === "error" ? error : ""}
      </p>
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-[#2E5BFF] px-4 py-3 font-bold text-white transition hover:bg-[#244BD9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E5BFF] disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? "Вход…" : "Войти в платформу"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#F5F7FA] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#0F172A] px-12 py-14 text-white lg:flex lg:flex-col">
        <div className="text-lg font-extrabold tracking-[0.08em]">ТЕХНОЗРЕЛОСТЬ</div>
        <div className="mt-1 font-mono text-xs text-slate-500">ГОСТ Р 58048-2017</div>
        <div className="my-auto max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[#7196FF]">
            Цифровая платформа ЦНТР
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.08] tracking-[-0.04em]">
            Один процесс — от заявки до внедрения технологии
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
            Проекты, оценка УГТ, документы и контрольные точки в едином рабочем
            контуре.
          </p>
          <div className="mt-12 grid grid-cols-9 gap-2" aria-label="Шкала УГТ от 1 до 9">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
              <div key={level} className="border-t-4 border-[#2E5BFF] pt-2 font-mono text-xs text-slate-400">
                УГТ {level}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">Центр научно-технологического развития</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="font-extrabold tracking-[0.08em] text-[#0F172A]">ТЕХНОЗРЕЛОСТЬ</div>
            <div className="mt-1 font-mono text-xs text-slate-500">ГОСТ Р 58048-2017</div>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
            Защищённый вход
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#0F172A]">
            Вход в платформу
          </h2>
          <p className="mt-3 text-slate-600">
            Используйте учётную запись вашей организации.
          </p>
          <Suspense fallback={<p className="mt-8 text-slate-500">Загрузка…</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-7 text-sm text-slate-600">
            Организация ещё не зарегистрирована?{" "}
            <Link href="/register" className="font-semibold text-[#2E5BFF] underline-offset-4 hover:underline">
              Подать заявку
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
