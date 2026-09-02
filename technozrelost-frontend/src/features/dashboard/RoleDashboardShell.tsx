'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  ClipboardList,
  Factory,
  FileClock,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Inbox,
  KeyRound,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  PlusCircle,
} from 'lucide-react';

import { AssessUgTCard } from '@/components/assess-ugt-card';
import { getProjects, joinProject } from '@/lib/api-client';
import { formatRelative, formatShortDate } from '@/lib/format-date';
import type { RoleSlug } from '@/lib/roles';
import { getStatusColor, getStatusLabel } from '@/lib/status';
import { categoryToTags, type ProjectCardOut } from '@/lib/types';
import ProfileVerificationQueue from '@/components/profile-verification-queue';

// Токен приглашения строго TZ-XXXXXX (6 алфанумериков, верхний регистр) — G12, R24.
const TZ_PATTERN = /^TZ-[A-Z0-9]{6}$/;

// Ключ избранного в localStorage — R24.1, G11, G26
const FAVORITE_KEY = 'tz:favorites';

// Метаданные ролей: заголовок, описание, иконка героической области и табы.
// Почему здесь: shell — единая точка правды для 8 ЛК (R02, R03, G02), табы по роли — G32.
const ROLE_META: Record<
  RoleSlug,
  { eyebrow: string; description: string; icon: typeof Building2; tabs: Array<{ label: string; href: string }> }
> = {
  gk_customer: {
    eyebrow: 'Рабочий стол заказчика',
    description:
      'Здесь появятся проекты вашей организации и их путь от заявки до внедрения технологии.',
    icon: Building2,
    tabs: [
      { label: 'Проекты', href: '/dashboard/gk_customer' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  rd_executor: {
    eyebrow: 'Рабочий стол R&D-исполнителя',
    description:
      'Здесь отображаются проекты вашей организации: от вступления по токену до верификации контрольных точек и передачи технологии в серию.',
    icon: FlaskConical,
    tabs: [
      { label: 'Проекты', href: '/dashboard/rd_executor' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  scientific_org: {
    eyebrow: 'Рабочий стол научной организации',
    description:
      'Научные организации участвуют в проектах как партнёры НИОКР: ведут исследования, подтверждают уровни УГТ и готовят отчётную документацию.',
    icon: GraduationCap,
    tabs: [
      { label: 'Проекты', href: '/dashboard/scientific_org' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  serial_manufacturer: {
    eyebrow: 'Рабочий стол серийного производителя',
    description:
      'Здесь представлены технологии уровня УГТ 7 и выше, готовые к опытному образцу, квалификации и серийному выпуску.',
    icon: Factory,
    tabs: [
      { label: 'Проекты', href: '/dashboard/serial_manufacturer' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  regulating_organization: {
    eyebrow: 'Рабочий стол регулирующей организации',
    description:
      'Присоединяйтесь к карточке проекта по токену TZ-XXXXXX и добавляйте документы подтверждения УГТ — они станут основанием для решения менеджера ЦНТР.',
    icon: ShieldCheck,
    tabs: [
      { label: 'Проекты', href: '/dashboard/regulating_organization' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  auditor: {
    eyebrow: 'Рабочий стол аудитора',
    description:
      'Оценивайте контрольные точки проектов (в первую очередь КТ-1) и принимайте решение Go/No-Go по технико-экономическому обоснованию.',
    icon: ClipboardList,
    tabs: [
      { label: 'Проекты', href: '/dashboard/auditor' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  investor: {
    eyebrow: 'Рабочий стол инвестора',
    description:
      'Изучайте реестр технологий платформы: уровень зрелости УГТ, организация-разработчик и перспективы внедрения. Реестр доступен только для чтения.',
    icon: TrendingUp,
    tabs: [
      { label: 'Проекты', href: '/dashboard/investor' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  cntr_admin: {
    eyebrow: 'Рабочий стол администратора ЦНТР',
    description:
      'Управляйте учётными записями и ролями пользователей платформы. Изменения применяются после нажатия «Сохранить» в строке пользователя.',
    icon: ShieldCheck,
    tabs: [
      { label: 'Проекты', href: '/dashboard/cntr_admin' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
  cntr_manager: {
    eyebrow: 'Рабочий стол менеджера ЦНТР',
    description:
      'Проверяйте карточки проектов и заявки на повышение УГТ. Финальное решение по уровню остаётся за менеджером ЦНТР.',
    icon: Inbox,
    tabs: [
      { label: 'Проекты', href: '/dashboard/cntr_manager' },
      { label: 'Новая заявка', href: '/dashboard/gk_customer/projects/new' },
      { label: 'Реестр технологий', href: '/dashboard/technologies' },
      { label: 'Каталог исполнителей', href: '/dashboard/executors' },
    ],
  },
};

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set<number>();
    try {
      const raw = localStorage.getItem(FAVORITE_KEY);
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch {
      // повреждённый localStorage — игнорируем
    }
    return new Set<number>();
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // hydrated флаг выставляем асинхронно через callback, чтобы не триггерить sync setState lint
    const id = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(FAVORITE_KEY, JSON.stringify([...favorites]));
    } catch {
      // quota exceeded — не ломаем UI
    }
  }, [favorites, hydrated]);

  const toggle = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: number) => favorites.has(id), [favorites]);

  return { favorites, toggle, isFavorite, count: favorites.size };
}

// Валидированный ввод токена TZ-XXXXXX — G12, R24, G05
function JoinTokenField({
  token,
  setToken,
  onSubmit,
  loading,
}: {
  token: string;
  setToken: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const normalized = token.trim().toUpperCase();

  const validate = (value: string): string | null => {
    if (!value) return 'Введите токен доступа.';
    if (!TZ_PATTERN.test(value)) return 'Формат токена: TZ-XXXXXX (6 символов A-Z, 0-9).';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(normalized);
    setError(err);
    if (err) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="join-token" className="mb-1 block text-xs font-medium text-tz-muted">
          Токен приглашения
        </label>
        <div className="relative">
          <KeyRound
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted"
          />
          <input
            id="join-token"
            type="text"
            value={token}
            onChange={(e) => {
              setToken(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="TZ-XXXXXX"
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? 'join-token-error' : undefined}
            className="w-full rounded-xl border border-tz-border bg-tz-surface py-2.5 pl-9 pr-3 font-mono text-sm text-tz-fg outline-none transition placeholder:text-tz-muted focus:border-[var(--tz-accent)] disabled:opacity-60"
          />
        </div>
        {error && (
          <p id="join-token-error" className="mt-1.5 text-xs font-medium text-tz-danger">
            {error}
          </p>
        )}
        <p className="mt-1 text-[11px] text-tz-muted">Пример: TZ-A1B2C3</p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tz-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--tz-accent-hover)] disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
        Вступить по TZ-XXXXXX
      </button>
    </form>
  );
}

interface RoleDashboardShellProps {
  role: RoleSlug;
}

export default function RoleDashboardShell({ role }: RoleDashboardShellProps) {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectCardOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinInfo, setJoinInfo] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const meta = ROLE_META[role];
  const Icon = meta.icon;
  const displayName = session?.user?.name ?? session?.user?.email ?? 'Пользователь';
  const { toggle, isFavorite } = useFavorites();

  const loadProjects = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects(session.user.accessToken);
      setProjects(Array.isArray(data) ? (data as ProjectCardOut[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить проекты.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    // setState внутри loadProjects выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadProjects();
    })();
  }, [loadProjects]);

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    draft: projects.filter((p) => p.status === 'draft' || p.status === 'auto_confirmed').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  };

  const statCards = [
    { label: 'Мои проекты', value: stats.total, icon: FolderKanban, color: 'var(--tz-accent)' },
    { label: 'Активные проекты', value: stats.active, icon: PlayCircle, color: 'var(--tz-success)' },
    {
      label: 'На согласовании',
      value: stats.draft,
      icon: FileClock,
      color: 'var(--tz-review)',
    },
    {
      label: role === 'scientific_org' ? 'Научные проекты' : 'Завершённые',
      value: role === 'scientific_org' ? stats.completed : stats.completed,
      icon: role === 'scientific_org' ? GraduationCap : Users,
      color: 'var(--tz-ugt-2)',
    },
  ];

  const filteredProjects = showFavoritesOnly
    ? projects.filter((p) => isFavorite(p.id))
    : projects;

  const handleJoin = useCallback(async () => {
    const normalized = joinToken.trim().toUpperCase();
    if (!TZ_PATTERN.test(normalized)) {
      setJoinError('Формат токена: TZ-XXXXXX');
      return;
    }
    if (!session?.user?.accessToken) {
      setJoinError('Сессия недоступна — войдите в систему заново.');
      return;
    }
    setJoinLoading(true);
    setJoinError(null);
    setJoinInfo(null);
    try {
      const data = await joinProject(normalized, role, session.user.accessToken);
      if (data?.status === 'active' && data.project?.id) {
        window.location.href = `/dashboard/project/${data.project.id}`;
        return;
      }
      setJoinInfo('Заявка отправлена на рассмотрение. Решение появится в карточке проекта.');
      await loadProjects();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Не удалось присоединиться к проекту.');
    } finally {
      setJoinLoading(false);
    }
  }, [joinToken, role, session, loadProjects]);

  return (
    <section>
      {/* Тёмный топбар 72px — G09, G32: общий топбар кабинета, светлая палитра внутри, тёмный только топбар */}
      <div
        className="mb-6 -mx-5 -mt-8 flex h-[72px] items-center gap-4 bg-[#1a1213] px-5 text-white sm:-mx-8 sm:px-8"
        style={{ background: 'var(--tz-hero-bg)' }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">
            {meta.eyebrow}
          </p>
          <p className="truncate text-sm font-semibold text-white">Личный кабинет · {role}</p>
        </div>
        {/* Кнопки в шапке — G51: без Cmd+K, без FAB */}
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link
            href="/dashboard/gk_customer/projects/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--tz-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tz-accent-hover)]"
          >
            <PlusCircle size={16} />
            Создать заявку
          </Link>
          <a
            href="#join"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <KeyRound size={16} />
            Вступить по TZ-XXXXXX
          </a>
        </div>
      </div>

      {/* Hero — Добро пожаловать, {name} — история 1, R15 */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">{meta.eyebrow}</p>
        <h1 className="tz-page-title mt-2 text-tz-fg">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">{meta.description}</p>
      </div>

      {/* Табы — G32, по роли */}
      <nav aria-label="Разделы рабочего стола" className="flex gap-6 overflow-x-auto border-b border-tz-border">
        {meta.tabs.map((tab, idx) => {
          const isActive = idx === 0;
          if (isActive) {
            return (
              <span
                key={tab.href}
                className="whitespace-nowrap border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg"
              >
                {tab.label}
              </span>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="whitespace-nowrap py-4 text-tz-secondary hover:text-tz-fg"
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Экспресс-оценка УГТ — доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      {/* 4 stat-cards — G10, hero + 4 stats — история 1 */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const StatIcon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-tz-card-border bg-tz-surface p-5"
              style={{ animation: `tz-rise 0.5s cubic-bezier(0.16,1,0.3,1) ${idx * 0.08}s both` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-tz-muted">{card.label}</span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  <StatIcon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-tz-surface-2" />
              ) : (
                <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-tz-fg">{card.value}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA + избранное фильтр */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/gk_customer/projects/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--tz-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--tz-accent-hover)]"
          >
            <PlusCircle size={16} />
            Создать заявку
          </Link>
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              showFavoritesOnly
                ? 'border-[var(--tz-accent)] bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]'
                : 'border-tz-border bg-tz-surface text-tz-secondary hover:border-[var(--tz-accent)] hover:text-[var(--tz-accent)]'
            }`}
          >
            <Star size={16} className={showFavoritesOnly ? 'fill-current' : ''} />
            {showFavoritesOnly ? 'Все проекты' : 'Избранное'}
          </button>
        </div>
        <span className="text-xs text-tz-muted">
          Показано: {filteredProjects.length} из {projects.length} (membership-фильтр, GET /projects)
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Список проектов — membership, через api-client.getProjects, ЦНТР-{id} */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="tz-card-title text-tz-fg">Мои проекты</h2>
            {!loading && !error && projects.length > 0 && (
              <span className="text-xs text-tz-muted">
                Обновлено: {formatShortDate(projects[0]?.updated_at ?? projects[0]?.created_at ?? null)}{' '}
                <span title={formatRelative(projects[0]?.updated_at ?? projects[0]?.created_at ?? null)}>
                  ({formatRelative(projects[0]?.updated_at ?? projects[0]?.created_at ?? null)})
                </span>
              </span>
            )}
          </div>

          {loading ? (
            <div className="rounded-[14px] border border-tz-border bg-tz-surface p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-tz-surface-2" />
              <div className="mt-4 h-16 animate-pulse rounded bg-tz-soft" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-tz-danger bg-tz-danger-soft p-8 text-center">
              <AlertCircle className="mx-auto mb-2 text-tz-danger" size={36} />
              <p className="font-semibold text-tz-danger">{error}</p>
              <button
                onClick={() => loadProjects()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <RefreshCw size={14} /> Повторить
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)] font-mono font-bold text-[var(--tz-accent)]">
                01
              </div>
              <h2 className="tz-section-title mt-5 text-tz-fg">Проектов пока нет</h2>
              <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
                {showFavoritesOnly
                  ? 'В избранном пока нет проектов. Отметьте звёздочкой проекты из общего списка.'
                  : 'Начните с фиксированной заявки. После сохранения она станет карточкой проекта и будет передана менеджеру ЦНТР на рассмотрение.'}
              </p>
              {!showFavoritesOnly && (
                <Link
                  href="/dashboard/gk_customer/projects/new"
                  className="mt-7 inline-flex rounded-lg bg-[var(--tz-accent)] px-5 py-3 font-bold text-white transition hover:bg-[var(--tz-accent-hover)]"
                >
                  Создать первую заявку
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredProjects.map((project) => {
                const color = getStatusColor(String(project.status));
                const shortDate = formatShortDate(project.updated_at ?? project.created_at);
                const relative = formatRelative(project.updated_at ?? project.created_at);
                const fav = isFavorite(project.id);
                return (
                  <div
                    key={project.id}
                    className="relative grid gap-4 rounded-[14px] border border-tz-border bg-tz-surface p-5 transition hover:border-[var(--tz-accent)] md:grid-cols-[1fr_auto_auto_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: `${color}15`, color }}
                        >
                          {getStatusLabel(String(project.status))}
                        </span>
                        {shortDate && (
                          <span
                            className="font-mono text-[11px] text-tz-muted"
                            title={relative ? `${shortDate} · ${relative}` : shortDate}
                          >
                            {shortDate}
                            {relative && (
                              <span className="ml-1 hidden sm:inline" title={relative}>
                                ({relative})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/project/${project.id}`}
                        className="mt-1 block text-lg font-bold text-tz-fg transition hover:text-[var(--tz-accent)]"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-1 text-sm text-tz-secondary">
                        {(project.tags?.[0] ?? project.category ?? categoryToTags(project.category)[0]) ??
                          'Категория не указана'}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <div className="text-xs text-tz-muted">Текущий уровень</div>
                      <div className="mt-1 font-bold text-[var(--tz-accent)]">УГТ {project.current_level}</div>
                    </div>
                    <div className="md:min-w-28 md:text-right">
                      <div className="text-xs text-tz-muted">Статус</div>
                      <div className="mt-1 font-semibold text-tz-fg">{getStatusLabel(String(project.status))}</div>
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <Link
                        href={`/dashboard/project/${project.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-tz-surface-2 px-3 py-2 text-xs font-semibold text-tz-secondary transition hover:bg-[var(--tz-accent-soft)] hover:text-[var(--tz-accent)]"
                      >
                        Открыть
                        <ArrowRight size={14} />
                      </Link>
                      <button
                        type="button"
                        aria-label={fav ? 'Убрать из избранного' : 'Добавить в избранное'}
                        aria-pressed={fav}
                        title={fav ? 'В избранном' : 'Добавить в избранное'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggle(project.id);
                        }}
                        className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                          fav
                            ? 'border-[var(--tz-accent)] bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]'
                            : 'border-tz-border bg-tz-surface text-tz-muted hover:border-[var(--tz-accent)] hover:text-[var(--tz-accent)]'
                        }`}
                      >
                        <Star size={16} className={fav ? 'fill-current' : ''} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Очередь верификации — только cntr_manager / cntr_admin (R32, G54) */}
        {(role === "cntr_manager" || role === "cntr_admin") && (
          <div className="col-span-2 lg:col-span-2">
            <ProfileVerificationQueue />
          </div>
        )}

        {/* Правая колонка: Вступить по TZ-XXXXXX + доп. CTA */}
        <aside id="join" className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-tz-card-border bg-tz-surface p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]">
                <KeyRound size={20} />
              </span>
              <div>
                <h3 className="font-bold text-tz-fg">Вступить по TZ-XXXXXX</h3>
                <p className="text-sm text-tz-muted">Токен выдаёт заказчик или ЦНТР</p>
              </div>
            </div>
            <div className="mt-4">
              <JoinTokenField token={joinToken} setToken={setJoinToken} onSubmit={handleJoin} loading={joinLoading} />
              {joinError && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-tz-danger bg-tz-danger-soft px-3 py-2.5 text-sm text-tz-danger">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {joinError}
                </p>
              )}
              {joinInfo && (
                <p className="mt-3 rounded-xl border border-tz-success bg-tz-success-soft px-3 py-2.5 text-sm text-tz-success">
                  {joinInfo}
                </p>
              )}
            </div>
          </div>

          {/* Мобильные кнопки в шапке дублируются как карточки — G51: кнопки в шапке, на мобилке — внутри колонки */}
          <div className="grid gap-3 sm:hidden">
            <Link
              href="/dashboard/gk_customer/projects/new"
              className="flex items-center justify-between rounded-2xl border border-tz-card-border bg-tz-surface p-5 transition hover:border-[var(--tz-accent)]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]">
                  <PlusCircle size={20} />
                </span>
                <span>
                  <span className="block font-bold text-tz-fg">Создать заявку</span>
                  <span className="text-sm text-tz-muted">Оценить и подать проект</span>
                </span>
              </span>
              <ArrowRight size={18} className="text-tz-muted" />
            </Link>
          </div>

          <div className="rounded-2xl border border-tz-card-border bg-tz-surface p-5">
            <h4 className="font-semibold text-tz-fg">Быстрые действия</h4>
            <div className="mt-3 grid gap-2">
              <Link
                href="/dashboard/gk_customer/projects/new"
                className="flex items-center justify-between rounded-xl bg-tz-soft px-4 py-3 text-sm font-medium text-tz-fg transition hover:bg-[var(--tz-accent-soft)] hover:text-[var(--tz-accent)]"
              >
                <span className="flex items-center gap-2">
                  <PlusCircle size={16} />
                  Создать заявку
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/dashboard/technologies"
                className="flex items-center justify-between rounded-xl bg-tz-soft px-4 py-3 text-sm font-medium text-tz-fg transition hover:bg-tz-soft"
              >
                Реестр технологий
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/dashboard/executors"
                className="flex items-center justify-between rounded-xl bg-tz-soft px-4 py-3 text-sm font-medium text-tz-fg transition hover:bg-tz-soft"
              >
                Каталог исполнителей
                <ArrowRight size={14} />
              </Link>
            </div>
            <p className="mt-3 text-xs text-tz-muted">
              Подсказка: роль в проекте может отличаться от роли в профиле и задаётся токеном TZ-XXXXXX (G07).
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
