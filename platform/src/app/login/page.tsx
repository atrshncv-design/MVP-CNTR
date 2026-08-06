"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import {
  BACKEND_ROLES,
  getRoleDefinition,
  isCenterRole,
  type BackendRoleId,
} from "@/lib/roles";
import { setMockRole } from "@/lib/session";

/**
 * T-003. Страница-заглушка входа (полноценный auth — T-013).
 * Сейчас вход — выбор демо-роли (mock-сессия): открывается стартовый маршрут
 * соответствующего кабинета. Демо-аккаунты зеркалят бэкенд (спека §2).
 */
export default function LoginPage() {
  const router = useRouter();

  const signIn = (id: BackendRoleId) => {
    setMockRole(id);
    const home = isCenterRole(id)
      ? "/operations"
      : (getRoleDefinition(id)?.home ?? "/app");
    router.push(home);
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          На главную
        </Link>

        <div className="mt-4 rounded-panel border border-border-subtle bg-surface p-6 md:p-8">
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Вход в платформу
          </h1>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Авторизация появится в ближайшем релизе. Сейчас вход выполняется
            через демо-аккаунты ролей.
          </p>

          <div className="mt-6 space-y-2" role="list" aria-label="Демо-аккаунты ролей">
            {BACKEND_ROLES.map((role) => (
              <button
                key={role.id}
                type="button"
                role="listitem"
                onClick={() => signIn(role.id)}
                className="group flex w-full items-center gap-3 rounded-control border border-border-subtle bg-canvas/60 px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent" aria-hidden>
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold text-primary">
                    {role.label}
                  </span>
                  <span className="block truncate font-mono text-meta text-muted">
                    {role.demoEmail}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent"
                  aria-hidden
                />
              </button>
            ))}
          </div>

          <p className="mt-5 flex items-start gap-2 text-meta leading-relaxed text-muted">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Демо-доступ: выбор роли открывает кабинет без пароля. Временный
            механизм для проверки интерфейса.
          </p>
        </div>
      </div>
    </main>
  );
}
