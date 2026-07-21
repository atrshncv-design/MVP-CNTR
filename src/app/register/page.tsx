"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLES } from "@/lib/roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Status = "idle" | "loading" | "error";

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
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data?.detail ?? "Не удалось зарегистрироваться");
      return;
    }
    // После регистрации — на страницу логина.
    router.push("/login");
  }

  return (
    <main className="mx-auto mt-16 max-w-md rounded-xl border border-gray-200 p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Регистрация</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">ФИО</label>
          <input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Пароль (мин. 8 символов)</label>
          <input type="password" required minLength={8} value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Организация</label>
          <input value={form.organization} onChange={(e) => update("organization", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Роль</label>
          <select value={form.role_slug} onChange={(e) => update("role_slug", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2">
            {ROLES.map((r) => (
              <option key={r.slug} value={r.slug}>{r.name}</option>
            ))}
          </select>
        </div>
        {status === "error" && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={status === "loading"}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
          {status === "loading" ? "Регистрация…" : "Зарегистрироваться"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Уже есть аккаунт? <Link href="/login" className="text-blue-600 underline">Войти</Link>
      </p>
    </main>
  );
}