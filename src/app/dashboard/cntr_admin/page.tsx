'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  History,
  Loader2,
  Save,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { ROLES } from '@/lib/roles';
import { AssessUgTCard } from "@/components/assess-ugt-card";
import {
  getAdminAudit,
  getAdminUsers,
  updateAdminUser,
  type AdminUser,
  type AuditEntry,
} from '@/lib/api-client';

/** Подпись роли по slug — из констант src/lib/roles.ts */
function roleName(slug: string): string {
  return ROLES.find((r) => r.slug === slug)?.name ?? slug;
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
      // PATCH /users/{id} — реальный эндпоинт администратора; ошибка 400/403/429
      // → ApiError (не «Сохранено»).
      await updateAdminUser(session.user.accessToken, user.id, { roles, is_active: isActive });
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
        <p className="mt-0.5 text-sm text-tz-muted">{user.email}</p>
      </td>
      <td className="px-4 py-4 text-sm text-tz-secondary">{user.organization ?? '—'}</td>
      <td className="px-4 py-4">
        {/* Текущий набор ролей */}
        <div className="mb-2 flex max-w-[280px] flex-wrap gap-1">
          {roles.length === 0 ? (
            <span className="text-xs text-tz-muted">Роли не назначены</span>
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
        <p className="mt-1 text-[11px] text-tz-muted">
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
            isActive ? 'bg-[#10B981]' : 'bg-tz-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-tz-surface shadow transition-transform ${
              isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <p className={`mt-1 text-xs ${isActive ? 'text-tz-success' : 'text-tz-muted'}`}>
          {isActive ? 'Активен' : 'Неактивен'}
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
/*  Журнал аудита (GET /admin/audit — только cntr_admin)               */
/* ------------------------------------------------------------------ */
function AdminAuditLog() {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await getAdminAudit(session.user.accessToken, 100));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал аудита.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="mt-10">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-tz-fg">
        <History size={18} className="text-tz-accent" /> Журнал аудита платформы
      </h2>
      <p className="mb-4 text-sm text-tz-muted">
        Последние события из append-only журнала (GET /api/v1/admin/audit).
      </p>

      {loading ? (
        <CardSkeleton bodyClassName="h-24" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<History size={22} className="text-[#2E5BFF]" />}
          title="Событий аудита пока нет"
          text="Записи появляются при действиях пользователей: создание проектов, решения менеджера, изменения ролей."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-tz-card-border bg-tz-surface">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-tz-card-border bg-[#FAFBFD] text-xs uppercase tracking-wider text-tz-muted">
                <th className="px-4 py-3 font-semibold">Событие</th>
                <th className="px-4 py-3 font-semibold">Пользователь</th>
                <th className="px-4 py-3 font-semibold">Проект</th>
                <th className="px-4 py-3 font-semibold">Время</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-tz-card-border align-top last:border-0 hover:bg-[#FAFBFD]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-tz-fg">{entry.action}</p>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <p className="mt-0.5 font-mono text-[11px] text-tz-muted">
                        {JSON.stringify(entry.details).slice(0, 120)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-tz-secondary">{entry.user_name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-tz-secondary">
                    {entry.project_id ? `#${entry.project_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-tz-muted">
                    {entry.created_at
                      ? new Date(entry.created_at).toLocaleString('ru-RU')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      setUsers(await getAdminUsers(session.user.accessToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей.');
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

  const statCards = [
    { label: 'Пользователи', value: users.length, icon: Users, color: '#2E5BFF' },
    { label: 'Активных', value: activeCount, icon: ShieldCheck, color: '#10B981' },
    { label: 'Назначений ролей', value: rolesAssigned, icon: UserCog, color: '#FF7A2E' },
  ];

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Рабочий стол администратора ЦНТР
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Управляйте учётными записями и ролями пользователей платформы. Изменения
          применяются после нажатия «Сохранить» в строке пользователя.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-tz-fg">
          Пользователи
        </span>
        <Link href="/dashboard/technologies" className="py-4 text-tz-secondary hover:text-tz-fg">
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
                <span className="text-sm font-medium text-tz-muted">{card.label}</span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-tz-surface-2" />
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
          <CardSkeleton bodyClassName="h-24" />
          ) : error ? (
          <ErrorState message={error} onRetry={() => loadUsers()} />
          ) : users.length === 0 ? (
          <EmptyState
            icon={<Users size={22} className="text-[#2E5BFF]" />}
            title="Пользователи не найдены"
            text="Зарегистрированные пользователи платформы появятся в этой таблице."
          />
          ) : (
          <div className="overflow-x-auto rounded-2xl border border-tz-card-border bg-tz-surface">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-tz-card-border bg-[#FAFBFD] text-xs uppercase tracking-wider text-tz-muted">
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

      {/* Журнал аудита — только cntr_admin (endpoint /admin/audit) */}
      <AdminAuditLog />
    </section>
  );
}
