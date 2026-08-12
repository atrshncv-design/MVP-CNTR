"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  Check,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { ROLES } from "@/lib/roles";
import { AssessUgTCard } from "@/components/assess-ugt-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  organization: string | null;
  is_active: boolean;
  roles: Array<{ role_no: number; slug: string; name: string }>;
  created_at: string;
}

/** Подпись роли по slug — из констант src/lib/roles.ts */
function roleName(slug: string): string {
  return ROLES.find((r) => r.slug === slug)?.name ?? slug;
}

/** Достаёт человекочитаемое сообщение об ошибке из ответа FastAPI */
function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const msg = (detail[0] as { msg?: unknown }).msg;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/*  Строка таблицы пользователей                                       */
/* ------------------------------------------------------------------ */
function UserRow({ user }: { user: AdminUser }) {
  const { data: session } = useSession();
  const [roles, setRoles] = useState<string[]>(user.roles.map((r) => r.slug));
  const [isActive, setIsActive] = useState<boolean>(user.is_active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveUser = async () => {
    if (!session?.user?.accessToken) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ roles, is_active: isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(extractError(data, `Не удалось сохранить пользователя (${res.status}).`));
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить пользователя.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-tz-card-border align-top last:border-0 hover:bg-tz-soft">
      <td className="px-4 py-4">
        <p className="font-semibold text-tz-fg">{user.full_name || "—"}</p>
        <p className="mt-0.5 text-sm text-tz-muted">{user.email}</p>
      </td>
      <td className="px-4 py-4 text-sm text-tz-secondary">{user.organization ?? "—"}</td>
      <td className="px-4 py-4">
        {/* Текущий набор ролей */}
        <div className="mb-2 flex max-w-[280px] flex-wrap gap-1">
          {roles.length === 0 ? (
            <span className="text-xs text-tz-muted">Роли не назначены</span>
          ) : (
            roles.map((slug) => (
              <span
                key={slug}
                className="rounded-md bg-tz-accent-soft px-2 py-0.5 text-[11px] font-medium text-tz-accent"
              >
                {roleName(slug)}
              </span>
            ))
          )}
        </div>
        {/* Мульти-выбор ролей */}
        <select
          multiple
          size={Math.min(5, ROLES.length)}
          value={roles}
          aria-label="Роли пользователя"
          aria-describedby={`roles-hint-${user.id}`}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (o) => o.value);
            setSaved(false);
            setRoles(selected);
          }}
          className="w-full max-w-[280px] rounded-xl border border-tz-border bg-tz-surface px-2 py-1.5 text-xs text-tz-fg outline-none transition focus:border-tz-accent"
        >
          {ROLES.map((r) => (
            <option key={r.slug} value={r.slug} className="py-0.5">
              {r.name}
            </option>
          ))}
        </select>
        <p id={`roles-hint-${user.id}`} className="mt-1 text-[11px] text-tz-muted">
          Cmd/Ctrl + клик — выбрать несколько ролей
        </p>
      </td>
      <td className="px-4 py-4">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label={isActive ? "Деактивировать" : "Активировать"}
          onClick={() => {
            setSaved(false);
            setIsActive((prev) => !prev);
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors after:absolute after:-inset-2 after:rounded-full after:content-[''] ${
            isActive ? "bg-tz-success" : "bg-tz-border"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-tz-surface shadow transition-transform ${
              isActive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <p className={`mt-1 text-xs ${isActive ? "text-tz-success" : "text-tz-muted"}`}>
          {isActive ? "Активен" : "Неактивен"}
        </p>
      </td>
      <td className="px-4 py-4 text-right">
        {error && <p className="mb-2 max-w-[220px] text-xs text-tz-danger">{error}</p>}
        {saved && (
          <p className="mb-2 flex items-center justify-end gap-1 text-xs font-medium text-tz-success">
            <Check size={13} /> Сохранено
          </p>
        )}
        <button
          onClick={saveUser}
          disabled={saving}
          className="tz-btn tz-btn-primary tz-btn-sm disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Сохранить
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Страница администрирования                                         */
/* ------------------------------------------------------------------ */
export default function CntrAdminDashboard() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Администратор ЦНТР";

  const loadUsers = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Не удалось загрузить пользователей (${res.status}).`);
      }
      setUsers((await res.json()) as AdminUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить пользователей.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      await loadUsers();
    })();
  }, [loadUsers]);

  const activeCount = users.filter((u) => u.is_active).length;
  const rolesAssigned = users.reduce((acc, u) => acc + u.roles.length, 0);
  const orgCount = new Set(users.map((u) => u.organization).filter(Boolean)).size;

  const statCards = [
    { label: "Пользователи", value: users.length, icon: Users, color: "var(--tz-accent)" },
    { label: "Активных", value: activeCount, icon: ShieldCheck, color: "var(--tz-success)" },
    { label: "Назначений ролей", value: rolesAssigned, icon: UserCog, color: "var(--tz-ugt-2)" },
    { label: "Организации", value: orgCount, icon: Building2, color: "var(--tz-review)" },
  ];

  return (
    <section>
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол администратора ЦНТР</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Управляйте учётными записями и ролями пользователей платформы. Изменения
          применяются после нажатия «Сохранить» в строке пользователя.
        </p>
      </div>

      {/* Данные: статистика из API */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx, duration: 0.4 }}
              className="tz-card tz-stat p-5"
            >
              <div className="tz-stat-label">
                {card.label}
                <span className="tz-stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-tz-soft" />
              ) : (
                <p className="tz-stat-value">{card.value}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Действия: экспресс-оценка УГТ (доступна любой роли) */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      {/* Данные: таблица пользователей */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="tz-card-title">Пользователи и роли</h2>
          <button className="tz-btn tz-btn-secondary tz-btn-sm" onClick={() => void loadUsers()}>
            <RefreshCw size={13} /> Обновить список
          </button>
        </div>

        {loading ? (
          <div className="tz-card mt-4 p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-tz-soft" />
            <div className="mt-4 h-24 animate-pulse rounded bg-tz-soft" />
          </div>
        ) : error ? (
          <div className="tz-card tz-empty mt-4">
            <AlertCircle className="text-tz-danger" size={32} />
            <p className="tz-empty-title">{error}</p>
            <button className="tz-btn tz-btn-secondary mt-6" onClick={() => void loadUsers()}>
              <RefreshCw size={15} /> Повторить
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="tz-card tz-empty mt-4">
            <span className="tz-empty-icon">
              <Users size={22} />
            </span>
            <h2 className="tz-empty-title">Пользователи не найдены</h2>
            <p className="tz-empty-text">
              Зарегистрированные пользователи платформы появятся в этой таблице.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-tz-card-border bg-tz-surface">
            <table className="tz-table w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-tz-card-border bg-tz-soft text-xs uppercase tracking-wider text-tz-muted">
                  <th className="px-4 py-3 font-semibold">Пользователь</th>
                  <th className="px-4 py-3 font-semibold">Организация</th>
                  <th className="px-4 py-3 font-semibold">Роли</th>
                  <th className="px-4 py-3 font-semibold">Активен</th>
                  <th className="px-4 py-3 text-right font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
