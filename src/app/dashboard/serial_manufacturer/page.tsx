'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Building2,
  Factory,
  Filter,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import JoinProjectForm from '@/components/join-project-form';

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

export default function SerialManufacturerDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Серийный производитель';

  const loadTechnologies = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ min_level: '7' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/v1/technologies?${params}`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Не удалось загрузить технологии (${res.status}).`);
      }
      setTechnologies((await res.json()) as Technology[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить технологии.');
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter]);

  useEffect(() => {
    // setState внутри loadTechnologies выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadTechnologies();
    })();
  }, [loadTechnologies]);

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-[#DFE5EC] pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Рабочий стол серийного производителя
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#0F172A]">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Здесь представлены технологии уровня УГТ 7 и выше, готовые к опытному
          образцу, квалификации и серийному выпуску.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-[#DFE5EC]">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-[#0F172A]">
          Технологии УГТ 7+
        </span>
        <a href="#join" className="py-4 text-slate-600 hover:text-[#0F172A]">
          Присоединиться к проекту
        </a>
        <a href="#registry" className="py-4 text-slate-600 hover:text-[#0F172A]">
          Каталог исполнителей
        </a>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Реестр технологий УГТ 7+ */}
        <div id="registry">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">Технологии УГТ 7+</h2>
              <p className="text-sm text-slate-500">Опытные образцы, готовые к квалификации и серии</p>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              {['all', 'active', 'completed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-[#2E5BFF] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'all' ? 'Все' : STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>

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
          ) : technologies.length === 0 ? (
            <div className="rounded-[14px] border border-[#DFE5EC] bg-white px-6 py-14 text-center sm:px-10">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF]">
                <Factory size={22} className="text-[#2E5BFF]" />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-[#0F172A]">
                Технологий УГТ 7+ пока нет
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Как только технология достигнет уровня опытного образца, она появится
                в этом реестре для оценки готовности к серийному выпуску.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {technologies.map((tech) => {
                const color = STATUS_COLORS[tech.status] ?? '#94A3B8';
                const progress =
                  tech.target_level > 0
                    ? Math.round((tech.current_level / tech.target_level) * 100)
                    : 0;
                return (
                  <motion.div
                    key={tech.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[#E8ECF0] bg-white p-5 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">Т-{tech.id}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${color}15`, color }}
                          >
                            {STATUS_LABELS[tech.status] ?? tech.status}
                          </span>
                          {tech.category && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                              {tech.category}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-lg font-bold text-[#0F172A]">{tech.name}</h3>
                        {tech.description && (
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">{tech.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          {tech.organization && (
                            <span className="flex items-center gap-1.5">
                              <Building2 size={14} className="text-[#FF7A2E]" />
                              {tech.organization}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Activity size={14} className="text-[#2E5BFF]" />
                            УГТ {tech.current_level} / {tech.target_level}
                          </span>
                        </div>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Готовность</span>
                          <span className="font-semibold text-[#2E5BFF]">{progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-[#2E5BFF] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Вступление по токену */}
        <aside id="join" className="lg:sticky lg:top-8 lg:self-start">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-[#E8ECF0] bg-white">
              <Loader2 size={22} className="animate-spin text-[#2E5BFF]" />
            </div>
          ) : (
            <JoinProjectForm />
          )}
        </aside>
      </div>
    </section>
  );
}
