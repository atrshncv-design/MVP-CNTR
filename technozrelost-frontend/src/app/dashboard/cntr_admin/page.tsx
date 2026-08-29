'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Award,
  BarChart3,
  Check,
  Clock,
  FileClock,
  FolderKanban,
  GitPullRequest,
  Layers,
  Loader2,
  Medal,
  RefreshCw,
  Save,
  ShieldCheck,
  Timer,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ROLES } from '@/lib/roles';

import { AssessUgTCard } from "@/components/assess-ugt-card";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";

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
    <tr className="border-b border-tz-card-border align-top last:border-0 hover:bg-[var(--tz-soft)]">
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
                className="rounded-md bg-[var(--tz-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--tz-accent)]"
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
          className="w-full max-w-[280px] rounded-xl border border-tz-border bg-tz-surface px-2 py-1.5 text-xs text-tz-fg outline-none transition focus:border-[var(--tz-accent)]"
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
            isActive ? 'bg-[var(--tz-success)]' : 'bg-tz-border'
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tz-accent)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--tz-accent-hover)] disabled:opacity-60"
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

/* ------------------------------------------------------------------ */
/*  Аналитика достижений (тикет 09, спека §4.7)                        */
/* ------------------------------------------------------------------ */

interface AchievementStats {
  generated_at: string;
  totals: {
    total_awards: number;
    awards_last_week: number;
    unique_users: number;
    unique_projects: number;
  };
  by_day: Array<{ date: string; count: number }>;
  by_week: Array<{ date: string; count: number }>;
  by_group: Array<{ key: string; count: number; percent: number }>;
  by_rarity: Array<{ key: string; count: number; percent: number }>;
  by_sector: Array<{ category: string; count: number; projects: number }>;
  top_achievements: Array<{
    slug: string;
    title: string;
    group: string;
    rarity: string;
    count: number;
  }>;
  stalled_projects: Array<{
    id: number;
    name: string;
    current_level: number;
    days: number;
  }>;
  manager_review: { avg_hours: number | null; decided_count: number };
}

const GROUP_LABELS: Record<string, string> = {
  ugt: 'Уровни УГТ',
  documents: 'Документы',
  project: 'Проекты',
  quality: 'Качество',
  sector: 'Отрасли',
  role: 'Роли',
  member: 'Участники',
  organization: 'Организации',
  secret: 'Секретные',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Обычная',
  epic: 'Эпическая',
  legendary: 'Легендарная',
  secret: 'Секретная',
};

const RARITY_COLORS: Record<string, string> = {
  common: 'var(--tz-neutral)',
  epic: 'var(--tz-accent)',
  legendary: 'var(--tz-warning)',
  secret: 'var(--tz-danger)',
};

/** Часы → компактная подпись («36 ч», «4.2 дн.»); null → «—». */
function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  const rounded = Math.round(hours * 10) / 10;
  if (rounded >= 24) {
    const days = Math.round((rounded / 24) * 10) / 10;
    return `${days} дн.`;
  }
  return `${rounded} ч`;
}

/** Карточка-контейнер блока аналитики. */
function AnalyticsCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-tz-card-border bg-tz-surface p-5">
      <h3 className="tz-card-title mb-4 flex items-center gap-2 text-tz-fg">
        <span className="text-[var(--tz-accent)]">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Столбчатая диаграмма по неделям — чистый CSS (flex + высоты в px). */
function WeekBars({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const BAR_MAX_PX = 88;
  return (
    <div className="flex h-44 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="h-3.5 text-[10px] font-medium leading-none tabular-nums text-tz-muted">
            {d.count > 0 ? d.count : ''}
          </span>
          <div
            title={`Неделя с ${d.date}: ${d.count} начислений`}
            className="w-full max-w-[30px] rounded-t-[4px] bg-[var(--tz-accent)]"
            style={{
              height: `${Math.max(
                d.count > 0 ? 6 : 2,
                Math.round((d.count / max) * BAR_MAX_PX),
              )}px`,
            }}
          />
          <span className="text-[9px] leading-none text-tz-muted">
            {d.date.slice(5).replace('-', '.')}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Горизонтальные полосы распределения (группы / редкость). */
function PercentRows({
  items,
  color,
}: {
  items: Array<{ key: string; count: number; percent: number }>;
  color: string | ((key: string) => string);
}) {
  if (items.length === 0) {
    return <p className="text-sm text-tz-muted">Пока нет данных</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-tz-fg">{item.key}</span>
            <span className="text-xs tabular-nums text-tz-muted">
              {item.count} · {item.percent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-tz-soft">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(item.count > 0 ? 2 : 0, item.percent)}%`,
                backgroundColor:
                  typeof color === 'function' ? color(item.key) : color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Отраслевые срезы: полосы по category проектов (проценты считаются здесь). */
function SectorRows({
  items,
}: {
  items: Array<{ category: string; count: number; projects: number }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-tz-muted">Пока нет отраслевых начислений</p>;
  }
  const total = items.reduce((acc, s) => acc + s.count, 0);
  return (
    <div className="space-y-3">
      {items.map((s) => {
        const percent = total > 0 ? Math.round((s.count / total) * 1000) / 10 : 0;
        return (
          <div key={s.category}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-tz-fg">{s.category}</span>
              <span className="text-xs tabular-nums text-tz-muted">
                {s.count} медалей · {s.projects} проект(ов) · {percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-tz-soft">
              <div
                className="h-full rounded-full bg-[var(--tz-accent)]"
                style={{ width: `${Math.max(s.count > 0 ? 2 : 0, percent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Экран «Аналитика достижений»: счётчики, графики, топ, застрявшие проекты. */
function AchievementsAnalytics({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: AchievementStats | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-tz-card-border bg-tz-surface"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border border-tz-danger bg-tz-danger-soft p-8 text-center">
        <AlertCircle className="mx-auto mb-2 text-tz-danger" size={36} />
        <p className="font-semibold text-tz-danger">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <RefreshCw size={14} /> Повторить
        </button>
      </div>
    );
  }

  const totals = stats?.totals ?? {
    total_awards: 0,
    awards_last_week: 0,
    unique_users: 0,
    unique_projects: 0,
  };
  const hasAwards = totals.total_awards > 0;
  const groupItems =
    stats?.by_group.map((g) => ({
      key: GROUP_LABELS[g.key] ?? g.key,
      count: g.count,
      percent: g.percent,
    })) ?? [];
  const rarityItems =
    stats?.by_rarity.map((r) => ({
      key: RARITY_LABELS[r.key] ?? r.key,
      count: r.count,
      percent: r.percent,
    })) ?? [];

  const counterCards = [
    { label: 'Всего начислений', value: totals.total_awards, icon: Award, color: 'var(--tz-accent)' },
    { label: 'За неделю', value: totals.awards_last_week, icon: TrendingUp, color: 'var(--tz-success)' },
    { label: 'Уникальных пользователей', value: totals.unique_users, icon: Users, color: 'var(--tz-ugt-mid)' },
    {
      label: 'Среднее время проверки',
      value: formatHours(stats?.manager_review.avg_hours ?? null),
      icon: Clock,
      color: 'var(--tz-warning)',
    },
  ];

  return (
    <div className="mt-6 space-y-6">
      {/* Счётчики */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counterCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-tz-card-border bg-tz-surface p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-tz-muted">{card.label}</span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-tz-fg">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Графики */}
      {!hasAwards ? (
        <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)]">
            <Medal size={22} className="text-[var(--tz-accent)]" />
          </div>
          <h2 className="tz-section-title mt-5 text-tz-fg">Начислений пока нет</h2>
          <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
            Графики и распределения заполнятся после первых подтверждённых
            событий УГТ и документов.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnalyticsCard title="Начисления по неделям" icon={<BarChart3 size={16} />}>
            <WeekBars data={stats?.by_week ?? []} />
          </AnalyticsCard>
          <AnalyticsCard title="Распределение по группам" icon={<Layers size={16} />}>
            <PercentRows items={groupItems} color="var(--tz-accent)" />
          </AnalyticsCard>
          <AnalyticsCard title="Редкость медалей" icon={<Medal size={16} />}>
            <PercentRows items={rarityItems} color={(key) => RARITY_COLORS[key] ?? 'var(--tz-neutral)'} />
          </AnalyticsCard>
          <AnalyticsCard title="Отраслевые срезы" icon={<Layers size={16} />}>
            <SectorRows items={stats?.by_sector ?? []} />
          </AnalyticsCard>
        </div>
      )}

      {/* Топ-10 медалей */}
      <AnalyticsCard title="Топ-10 медалей" icon={<Trophy size={16} />}>
        {!hasAwards || !stats || stats.top_achievements.length === 0 ? (
          <p className="text-sm text-tz-muted">Пока нет данных</p>
        ) : (
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {stats.top_achievements.map((m, i) => (
              <li
                key={m.slug}
                className="flex items-center gap-3 rounded-xl border border-tz-card-border bg-tz-surface px-3 py-2"
              >
                <span className="w-6 text-right font-mono text-sm text-tz-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-tz-fg">{m.title}</p>
                  <p className="text-[11px] text-tz-muted">
                    {GROUP_LABELS[m.group] ?? m.group} · {RARITY_LABELS[m.rarity] ?? m.rarity}
                  </p>
                </div>
                <span className="rounded-md bg-[var(--tz-accent-soft)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--tz-accent)]">
                  {m.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </AnalyticsCard>

      {/* Застрявшие проекты */}
      <AnalyticsCard
        title="Застрявшие проекты (90+ дней без движения)"
        icon={<Timer size={16} />}
      >
        {!stats || stats.stalled_projects.length === 0 ? (
          <p className="text-sm text-tz-muted">Застрявших проектов нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-tz-card-border bg-[var(--tz-soft)] text-xs uppercase tracking-wider text-tz-muted">
                  <th className="px-3 py-2.5 font-semibold">Проект</th>
                  <th className="px-3 py-2.5 font-semibold">Уровень УГТ</th>
                  <th className="px-3 py-2.5 font-semibold">Дней без движения</th>
                </tr>
              </thead>
              <tbody>
                {stats.stalled_projects.map((p) => (
                  <tr key={p.id} className="border-b border-tz-card-border last:border-0">
                    <td className="px-3 py-2.5 text-sm font-medium text-tz-fg">{p.name}</td>
                    <td className="px-3 py-2.5 text-sm tabular-nums text-tz-secondary">
                      {p.current_level}
                    </td>
                    <td className="px-3 py-2.5 text-sm tabular-nums text-tz-warning">{p.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}

export default function CntrAdminDashboard() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'users' | 'achievements'>('users');
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  // KPI 12 — расширенный набор для единого центра управления (19-, 26-)
  const [kpiProjects, setKpiProjects] = useState<Array<{ status: string; budget: number | null; current_level: number }>>([]);
  const [kpiDrafts, setKpiDrafts] = useState<number>(0);
  const [kpiPromotions, setKpiPromotions] = useState<number>(0);
  const [kpiQueuePending, setKpiQueuePending] = useState<number>(0);

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


  const loadStats = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/achievements/stats`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Не удалось загрузить аналитику (${res.status}).`);
      }
      setStats((await res.json()) as AchievementStats);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Не удалось загрузить аналитику.');
    } finally {
      setStatsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    // setState внутри loadStats выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadStats();
    })();
  }, [loadStats]);

  const loadKpi = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    try {
      const headers = { Authorization: `Bearer ${session.user.accessToken}` };
      const [projRes, draftRes, promoRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/projects`, { headers }),
        fetch(`${API_URL}/api/v1/manager/queue/drafts`, { headers }),
        fetch(`${API_URL}/api/v1/manager/queue/promotions`, { headers }),
        fetch(`${API_URL}/api/v1/metrics`, { headers: {} }),
      ]);
      if (projRes.ok) {
        const projs = (await projRes.json()) as Array<{ status: string; budget: number | null; current_level: number }>;
        setKpiProjects(projs);
      }
      if (draftRes.ok) {
        const drafts = (await draftRes.json()) as unknown[];
        setKpiDrafts(drafts.length);
      }
      if (promoRes.ok) {
        const promos = (await promoRes.json()) as unknown[];
        setKpiPromotions(promos.length);
      }
      if (metricsRes.ok) {
        const text = await metricsRes.text();
        const m = text.match(/queue_pending\s+(\d+)/);
        if (m) setKpiQueuePending(parseInt(m[1], 10));
      }
    } catch {
      // KPI fallback — нули, не ломаем страницу
    }
  }, [session]);

  useEffect(() => {
    (async () => { await loadKpi(); })();
  }, [loadKpi]);

  const activeCount = users.filter((u) => u.is_active).length;
  const rolesAssigned = users.reduce((acc, u) => acc + u.roles.length, 0);
  const totalBudget = kpiProjects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const publishedCount = kpiProjects.filter((p) => p.status === 'published' || p.status === 'active').length;
  const draftCount = kpiProjects.filter((p) => p.status === 'draft').length;
  const stalledCount = stats?.stalled_projects.length ?? 0;
  const totalAwards = stats?.totals.total_awards ?? 0;

  function budgetFmt(v: number | null): string {
    if (v == null || v === 0) return '—';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
  }

  // 12 KPI для единого центра администратора (19- max, 26- расширение)
  const statCards = [
    { label: 'Пользователи', value: users.length, icon: Users, color: 'var(--tz-accent)' },
    { label: 'Активных', value: activeCount, icon: ShieldCheck, color: 'var(--tz-success)' },
    { label: 'Назначений ролей', value: rolesAssigned, icon: UserCog, color: 'var(--tz-ugt-2)' },
    { label: 'Всего проектов', value: kpiProjects.length, icon: FolderKanban, color: 'var(--tz-accent)' },
    { label: 'Черновиков', value: draftCount, icon: FileClock, color: 'var(--tz-warning)' },
    { label: 'Опубликовано', value: publishedCount, icon: Award, color: 'var(--tz-success)' },
    { label: 'Бюджет портфеля', value: totalBudget ? budgetFmt(totalBudget) : '—', icon: Wallet, color: 'var(--tz-ugt-mid)' },
    { label: 'Новых в очереди', value: kpiDrafts, icon: FileClock, color: 'var(--tz-warning)' },
    { label: 'Заявок на повышение', value: kpiPromotions, icon: GitPullRequest, color: 'var(--tz-accent)' },
    { label: 'Очередь pending', value: kpiQueuePending, icon: Layers, color: 'var(--tz-neutral)' },
    { label: 'Застрявших 90д+', value: stalledCount, icon: Timer, color: 'var(--tz-danger)' },
    { label: 'Всего наград', value: totalAwards, icon: Trophy, color: 'var(--tz-warning)' },
  ];

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Рабочий стол администратора ЦНТР
        </p>
        <h1 className="tz-page-title mt-2 text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Управляйте учётными записями и ролями пользователей платформы. Изменения
          применяются после нажатия «Сохранить» в строке пользователя.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex flex-wrap gap-x-6 border-b border-tz-border">
        <button
          type="button"
          onClick={() => setView('users')}
          aria-current={view === 'users' ? 'page' : undefined}
          className={
            view === 'users'
              ? 'border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg'
              : 'py-4 text-tz-secondary hover:text-tz-fg'
          }
        >
          Пользователи
        </button>
        <button
          type="button"
          onClick={() => setView('achievements')}
          aria-current={view === 'achievements' ? 'page' : undefined}
          className={
            view === 'achievements'
              ? 'border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg'
              : 'py-4 text-tz-secondary hover:text-tz-fg'
          }
        >
          Аналитика достижений
        </button>
        <Link href="/dashboard/technologies" className="py-4 text-tz-secondary hover:text-tz-fg">
          Реестр технологий
        </Link>
      </nav>

      <div className={view === 'users' ? '' : 'hidden'}>
      {/* Экспресс-оценка УГТ — тикет 26: доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      {/* KPI 12 — единый центр администратора (19- max) */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="admin-kpi-grid">
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
        <h2 className="mb-4 tz-card-title text-tz-fg">Пользователи и роли</h2>

        {loading ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-tz-surface-2" />
            <div className="mt-4 h-24 animate-pulse rounded bg-tz-soft" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-tz-danger bg-tz-danger-soft p-8 text-center">
            <AlertCircle className="mx-auto mb-2 text-tz-danger" size={36} />
            <p className="font-semibold text-tz-danger">{error}</p>
            <button
              onClick={() => loadUsers()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)]">
              <Users size={22} className="text-[var(--tz-accent)]" />
            </div>
            <h2 className="tz-section-title mt-5 text-tz-fg">
              Пользователи не найдены
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
              Зарегистрированные пользователи платформы появятся в этой таблице.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-tz-card-border bg-tz-surface">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-tz-card-border bg-[var(--tz-soft)] text-xs uppercase tracking-wider text-tz-muted">
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
      </div>

      {view === 'achievements' && (
        <AchievementsAnalytics
          stats={stats}
          loading={statsLoading}
          error={statsError}
          onRetry={() => loadStats()}
        />
      )}
    </section>
  );
}
