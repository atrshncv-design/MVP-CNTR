"use client";

import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import {
  BACKEND_ROLES,
  getRoleDefinition,
  isCenterRole,
  type BackendRoleId,
} from "@/lib/roles";
import { setMockRole } from "@/lib/session";

export interface RoleSwitcherProps {
  /** Текущая демо-роль (сессия). */
  current: BackendRoleId;
  /** Заголовок блока. */
  title?: string;
}

/**
 * T-003. Временный dev-инструмент (полноценная авторизация — T-013):
 * переключатель демо-ролей в футере сайдбара. Рендерится только в dev-сборке,
 * помечен «Демо-режим». Смена роли переводит в стартовый маршрут кабинета
 * роли (роли Центра — в операционный шелл).
 */
export function RoleSwitcher({ current, title = "Демо-режим" }: RoleSwitcherProps) {
  const router = useRouter();

  if (process.env.NODE_ENV !== "development") return null;

  const change = (id: BackendRoleId) => {
    setMockRole(id);
    const home = isCenterRole(id)
      ? "/operations"
      : (getRoleDefinition(id)?.home ?? "/app");
    router.push(home);
    router.refresh();
  };

  return (
    <div className="rounded-panel border border-dashed border-border-strong bg-canvas/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-meta font-medium uppercase tracking-wider text-muted">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          {title}
        </span>
        <span className="rounded-[4px] bg-accent-soft px-1.5 py-0.5 text-meta font-medium text-accent">
          dev
        </span>
      </div>
      <label htmlFor="demo-role-select" className="mt-2 block text-small text-secondary">
        Роль для проверки интерфейса
      </label>
      <select
        id="demo-role-select"
        value={current}
        onChange={(event) => change(event.target.value as BackendRoleId)}
        className="mt-1.5 h-10 w-full rounded-control border border-border-subtle bg-surface px-2.5 text-small text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        {BACKEND_ROLES.map((role) => (
          <option key={role.id} value={role.id}>
            {role.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-meta leading-relaxed text-muted">
        Временный инструмент: полноценная авторизация появится позже.
      </p>
    </div>
  );
}
