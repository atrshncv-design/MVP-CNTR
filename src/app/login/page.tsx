"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (!res || res.error) {
      setStatus("error");
      setError("Неверный email или пароль");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Пароль</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "loading" ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto mt-16 max-w-md rounded-xl border border-gray-200 p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Вход в платформу «Технозрелость»</h1>
      <Suspense fallback={<p className="text-gray-500">Загрузка…</p>}>
        <LoginForm />
      </Suspense>
      <p className="mt-4 text-sm text-gray-600">
        Нет аккаунта? <Link href="/register" className="text-blue-600 underline">Зарегистрироваться</Link>
      </p>
    </main>
  );
}