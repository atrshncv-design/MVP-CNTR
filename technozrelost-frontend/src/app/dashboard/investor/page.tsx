'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Building2,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
import { AssessUgTCard } from "@/components/assess-ugt-card";

/** Реестр технологий = опубликованные проекты УГТ 7+ (решение №14): RegistryProjectOut. */
interface Technology {
  id: number;
  name: string;
  category: string | null;
  current_level: number;
  preliminary_level: number | null;
  target_level: number;
  budget: number | null;
  organization: string | null;
  created_at: string | null;
}

const PUBLISHED_COLOR = 'var(--tz-success)';

const UGT_OPTIONS = [7, 8, 9];

export default function InvestorDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minLevel, setMinLevel] = useState<number>(7);

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Инвестор';

  const loadTechnologies = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ugt_min: String(minLevel) });
      const res = await fetch(`${API_URL}/api/v1/projects/registry?${params}`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Не удалось загрузить реестр технологий (${res.status}).`);
      }
      setTechnologies((await res.json()) as Technology[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить реестр технологий.');
    } finally {
      setLoading(false);
    }
  }, [session, minLevel]);

  useEffect(() => {
    // setState внутри loadTechnologies выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadTechnologies();
    })();
  }, [loadTechnologies]);

  /** Категории — из данных реестра, чтобы селект всегда был актуален */
  const categories = useMemo(() => {
    const set = new Set<string>();
    technologies.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [technologies]);

  const filtered = useMemo(() => {
    return technologies.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.organization?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [technologies, categoryFilter, search]);

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Рабочий стол инвестора
        </p>
        <h1 className="tz-page-title mt-2 text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Изучайте реестр технологий платформы: уровень зрелости УГТ, организация-
          разработчик и перспективы внедрения. Реестр доступен только для чтения.
        </p>
      </div>

      {/* Экспресс-оценка УГТ — тикет 26: доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg">
          Реестр технологий
        </span>
      </nav>

      {/* Фильтры */}
      <div className="mt-8 rounded-2xl border border-tz-card-border bg-tz-surface p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию…"
              className="w-full rounded-xl border border-tz-border bg-tz-surface py-2.5 pl-9 pr-3 text-sm text-tz-fg outline-none transition placeholder:text-tz-muted focus:border-[var(--tz-accent)]"
            />
          </div>
          <div>
            <label htmlFor="inv-category" className="mb-1 block text-xs font-medium text-tz-muted">
              Категория
            </label>
            <select
              id="inv-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg outline-none transition focus:border-[var(--tz-accent)]"
            >
              <option value="all">Все категории</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-level" className="mb-1 block text-xs font-medium text-tz-muted">
              Уровень УГТ не ниже
            </label>
            <select
              id="inv-level"
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg outline-none transition focus:border-[var(--tz-accent)]"
            >
              {UGT_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  УГТ {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Реестр */}
      <div className="mt-6">
        <h2 className="tz-card-title mb-4 text-tz-fg">
          Реестр технологий <span className="text-sm font-normal text-tz-muted">({filtered.length})</span>
        </h2>

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
              onClick={() => loadTechnologies()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)]">
              <TrendingUp size={22} className="text-[var(--tz-accent)]" />
            </div>
            <h2 className="tz-section-title mt-5 text-tz-fg">
              Технологии не найдены
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
              Измените параметры фильтров или дождитесь появления новых технологий в реестре.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((tech) => {
              const progress =
                tech.target_level > 0
                  ? Math.min(100, Math.round((tech.current_level / tech.target_level) * 100))
                  : 0;
              return (
                <motion.div
                  key={tech.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-tz-card-border bg-tz-surface p-5 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-tz-fg">{tech.name}</h3>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: `${PUBLISHED_COLOR}15`, color: PUBLISHED_COLOR }}
                    >
                      В реестре
                    </span>
                  </div>

                  {/* Радар зрелости: прогресс current → target */}
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-tz-muted">
                        <Activity size={13} className="text-[var(--tz-accent)]" />
                        Зрелость УГТ
                      </span>
                      <span className="font-semibold text-[var(--tz-accent)]">
                        УГТ {tech.current_level} → {tech.target_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-tz-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--tz-accent)] to-[var(--tz-success)] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-tz-fg">{progress}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-tz-muted">
                    {tech.organization && (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-[var(--tz-ugt-2)]" />
                        {tech.organization}
                      </span>
                    )}
                    {tech.category && (
                      <span className="rounded-md bg-tz-surface-2 px-2 py-0.5 text-xs text-tz-secondary">
                        {tech.category}
                      </span>
                    )}
                    {tech.budget != null && (
                      <span className="flex items-center gap-1.5">
                        <Wallet size={14} className="text-tz-muted" />
                        {tech.budget.toLocaleString('ru-RU')} млн ₽
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Инвестор не участвует в проектах — форма вступления не показывается */}
    </section>
  );
}
