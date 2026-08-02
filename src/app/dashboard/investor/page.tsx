'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Building2,
  Clock,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface Technology {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  current_level: number;
  target_level: number;
  organization: string | null;
  created_by_name: string | null;
  created_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активна',
  review: 'На проверке',
  completed: 'Завершена',
  rejected: 'Отклонена',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  active: '#2E5BFF',
  review: '#E5C840',
  completed: '#10B981',
  rejected: '#EF4444',
};

const UGT_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);

export default function InvestorDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minLevel, setMinLevel] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Инвестор';

  const loadTechnologies = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/technologies`, {
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
  }, [session]);

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
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (t.current_level < minLevel) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.organization?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [technologies, categoryFilter, statusFilter, minLevel, search]);

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-[#DFE5EC] pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Рабочий стол инвестора
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#0F172A]">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Изучайте реестр технологий платформы: уровень зрелости УГТ, организация-
          разработчик и перспективы внедрения. Реестр доступен только для чтения.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-[#DFE5EC]">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-[#0F172A]">
          Реестр технологий
        </span>
      </nav>

      {/* Фильтры */}
      <div className="mt-8 rounded-2xl border border-[#E8ECF0] bg-white p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию…"
              className="w-full rounded-xl border border-[#DFE5EC] bg-white py-2.5 pl-9 pr-3 text-sm text-[#0F172A] outline-none transition placeholder:text-slate-400 focus:border-[#2E5BFF]"
            />
          </div>
          <div>
            <label htmlFor="inv-category" className="mb-1 block text-xs font-medium text-slate-500">
              Категория
            </label>
            <select
              id="inv-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-[#DFE5EC] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none transition focus:border-[#2E5BFF]"
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
            <label htmlFor="inv-level" className="mb-1 block text-xs font-medium text-slate-500">
              Уровень УГТ не ниже
            </label>
            <select
              id="inv-level"
              value={minLevel}
              onChange={(e) => setMinLevel(Number(e.target.value))}
              className="w-full rounded-xl border border-[#DFE5EC] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none transition focus:border-[#2E5BFF]"
            >
              {UGT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  УГТ {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-status" className="mb-1 block text-xs font-medium text-slate-500">
              Статус
            </label>
            <select
              id="inv-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-[#DFE5EC] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none transition focus:border-[#2E5BFF]"
            >
              <option value="all">Любой</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Реестр */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-bold text-[#0F172A]">
          Реестр технологий <span className="text-sm font-normal text-slate-400">({filtered.length})</span>
        </h2>

        {loading ? (
          <div className="rounded-[14px] border border-[#DFE5EC] bg-white p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
            <div className="mt-4 h-16 animate-pulse rounded bg-gray-50" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto mb-2 text-red-500" size={36} />
            <p className="font-semibold text-red-700">{error}</p>
            <button
              onClick={() => loadTechnologies()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <RefreshCw size={14} /> Повторить
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[14px] border border-[#DFE5EC] bg-white px-6 py-14 text-center sm:px-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF]">
              <TrendingUp size={22} className="text-[#2E5BFF]" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-[#0F172A]">
              Технологии не найдены
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Измените параметры фильтров или дождитесь появления новых технологий в реестре.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((tech) => {
              const color = STATUS_COLORS[tech.status] ?? '#94A3B8';
              const progress =
                tech.target_level > 0
                  ? Math.min(100, Math.round((tech.current_level / tech.target_level) * 100))
                  : 0;
              return (
                <motion.div
                  key={tech.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-[#E8ECF0] bg-white p-5 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-[#0F172A]">{tech.name}</h3>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: `${color}15`, color }}
                    >
                      {STATUS_LABELS[tech.status] ?? tech.status}
                    </span>
                  </div>
                  {tech.description && (
                    <p className="mt-2 text-sm text-slate-500 line-clamp-2">{tech.description}</p>
                  )}

                  {/* Радар зрелости: прогресс current → target */}
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Activity size={13} className="text-[#2E5BFF]" />
                        Зрелость УГТ
                      </span>
                      <span className="font-semibold text-[#2E5BFF]">
                        УГТ {tech.current_level} → {tech.target_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#2E5BFF] to-[#10B981] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[#0F172A]">{progress}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
                    {tech.organization && (
                      <span className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-[#FF7A2E]" />
                        {tech.organization}
                      </span>
                    )}
                    {tech.category && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {tech.category}
                      </span>
                    )}
                    {tech.created_by_name && (
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-400" />
                        {tech.created_by_name}
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
