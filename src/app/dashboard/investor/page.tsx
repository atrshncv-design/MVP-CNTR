'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Building2,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { getProjectRegistry, type RegistryProject } from "@/lib/api-client";
import { AssessUgTCard } from "@/components/assess-ugt-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";

const PUBLISHED_COLOR = '#10B981';

const UGT_OPTIONS = [7, 8, 9];

export default function InvestorDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<RegistryProject[]>([]);
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
      const list = await getProjectRegistry(session.user.accessToken, { ugt_min: minLevel });
      setTechnologies(list);
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
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-tz-fg">
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
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-tz-fg">
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
              className="w-full rounded-xl border border-tz-border bg-tz-surface py-2.5 pl-9 pr-3 text-sm text-tz-fg outline-none transition placeholder:text-tz-muted focus:border-[#2E5BFF]"
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
              className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg outline-none transition focus:border-[#2E5BFF]"
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
              className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg outline-none transition focus:border-[#2E5BFF]"
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
        <h2 className="mb-4 text-lg font-bold text-tz-fg">
          Реестр технологий <span className="text-sm font-normal text-tz-muted">({filtered.length})</span>
        </h2>

        {loading ? (
          <CardSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadTechnologies()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={22} className="text-[#2E5BFF]" />}
            title="Технологии не найдены"
            text="Измените параметры фильтров или дождитесь появления новых технологий в реестре."
          />
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
                        <Activity size={13} className="text-[#2E5BFF]" />
                        Зрелость УГТ
                      </span>
                      <span className="font-semibold text-[#2E5BFF]">
                        УГТ {tech.current_level} → {tech.target_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-tz-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#2E5BFF] to-[#10B981] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-tz-fg">{progress}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-tz-muted">
                    {tech.organization && (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-[#FF7A2E]" />
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
