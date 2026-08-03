'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { ROLES } from '@/lib/roles';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
import { AssessUgTCard } from "@/components/assess-ugt-card";

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
  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
      const msg = (detail[0] as { msg?: unknown }).msg;
      if (typeof msg === 'string') return msg;
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
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
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
      setError(e instanceof Error ? e.message : 'Не удалось сохранить пользователя.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-tz-card-border align-top last:border-0 hover:bg-[#FAFBFD]">
      <td className="px-4 py-4">
        <p className="font-semibold text-tz-fg">{user.full_name || '—'}</p>
        <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">{user.organization ?? '—'}</td>
      <td className="px-4 py-4">
        {/* Текущий набор ролей */}
        <div className="mb-2 flex max-w-[280px] flex-wrap gap-1">
          {roles.length === 0 ? (
            <span className="text-xs text-slate-400">Роли не назначены</span>
          ) : (
            roles.map((slug) => (
              <span
                key={slug}
                className="rounded-md bg-[#EAF0FF] px-2 py-0.5 text-[11px] font-medium text-[#2E5BFF]"
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
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (o) => o.value);
            setSaved(false);
            setRoles(selected);
          }}
          className="w-full max-w-[280px] rounded-xl border border-tz-border bg-tz-surface px-2 py-1.5 text-xs text-tz-fg outline-none transition focus:border-[#2E5BFF]"
        >
          {ROLES.map((r) => (
            <option key={r.slug} value={r.slug} className="py-0.5">
              {r.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          Cmd/Ctrl + клик — выбрать несколько ролей
        </p>
      </td>
      <td className="px-4 py-4">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label={isActive ? 'Деактивировать' : 'Активировать'}
          onClick={() => {
            setSaved(false);
            setIsActive((prev) => !prev);
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            isActive ? 'bg-[#10B981]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-tz-surface shadow transition-transform ${
              isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <p className={`mt-1 text-xs ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
          {isActive ? 'Активен' : 'Неактивен'}
        </p>
      </td>
      <td className="px-4 py-4 text-right">
        {error && <p className="mb-2 max-w-[220px] text-xs text-red-600">{error}</p>}
        {saved && (
          <p className="mb-2 flex items-center justify-end gap-1 text-xs font-medium text-emerald-600">
            <Check size={13} /> Сохранено
          </p>
        )}
        <button
          onClick={saveUser}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E5BFF] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#244BD9] disabled:opacity-60"
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

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Администратор ЦНТР';

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
      setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    // setState внутри loadUsers выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadUsers();
    })();
  }, [loadUsers]);

  const activeCount = users.filter((u) => u.is_active).length;
  const rolesAssigned = users.reduce((acc, u) => acc + u.roles.length, 0);

  const statCards = [
    { label: 'Пользователи', value: users.length, icon: Users, color: '#2E5BFF' },
    { label: 'Активных', value: activeCount, icon: ShieldCheck, color: '#10B981' },
    { label: 'Назначений ролей', value: rolesAssigned, icon: UserCog, color: '#FF7A2E' },
  ];

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Рабочий стол администратора ЦНТР
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Управляйте учётными записями и ролями пользователей платформы. Изменения
          применяются после нажатия «Сохранить» в строке пользователя.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-tz-fg">
          Пользователи
        </span>
        <Link href="/dashboard/technologies" className="py-4 text-slate-600 hover:text-tz-fg">
          Реестр технологий
        </Link>
      </nav>

      {/* Экспресс-оценка УГТ — тикет 26: доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      {/* Статистика */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx, duration: 0.4 }}
              className="rounded-2xl border border-tz-card-border bg-tz-surface p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">{card.label}</span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-gray-100" />
              ) : (
                <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-tz-fg">{card.value}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Таблица пользователей */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-tz-fg">Пользователи и роли</h2>

        {loading ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
            <div className="mt-4 h-24 animate-pulse rounded bg-gray-50" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto mb-2 text-red-500" size={36} />
            <p className="font-semibold text-red-700">{error}</p>
            <button
              onClick={() => loadUsers()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF]">
              <Users size={22} className="text-[#2E5BFF]" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-tz-fg">
              Пользователи не найдены
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Зарегистрированные пользователи платформы появятся в этой таблице.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-tz-card-border bg-tz-surface">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-tz-card-border bg-[#FAFBFD] text-xs uppercase tracking-wider text-slate-500">
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
