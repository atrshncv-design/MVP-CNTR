'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, FolderKanban, PlayCircle, FileClock, Briefcase, Loader2, RefreshCw } from 'lucide-react';
import JoinProjectForm from '@/components/join-project-form';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface Project {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  target_level: number;
  current_level: number;
  status: string;
  budget: number | null;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'В работе',
  review: 'На проверке',
  completed: 'Завершён',
  rejected: 'Отклонён',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  active: '#2E5BFF',
  review: '#E5C840',
  completed: '#10B981',
  rejected: '#EF4444',
};

export default function RdExecutorDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? 'R&D-исполнитель';

  const loadProjects = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Не удалось загрузить проекты (${res.status}).`);
      }
      setProjects((await res.json()) as Project[]);
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

  const active = projects.filter((p) => p.status === 'active').length;
  const review = projects.filter((p) => p.status === 'review' || p.status === 'draft').length;
  const completed = projects.filter((p) => p.status === 'completed').length;

  const statCards = [
    { label: 'Мои проекты', value: projects.length, icon: FolderKanban, color: '#2E5BFF' },
    { label: 'Активные проекты', value: active, icon: PlayCircle, color: '#10B981' },
    { label: 'На рассмотрении', value: review, icon: FileClock, color: '#E5C840' },
    { label: 'Завершённые', value: completed, icon: Briefcase, color: '#FF7A2E' },
  ];

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-[#DFE5EC] pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Рабочий стол R&D-исполнителя
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-[#0F172A]">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Здесь отображаются проекты вашей организации: от вступления по токену до
          верификации контрольных точек и передачи технологии в серию.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-[#DFE5EC]">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-[#0F172A]">Проекты</span>
        <Link href="/dashboard/technologies" className="py-4 text-slate-600 hover:text-[#0F172A]">
          Реестр технологий
        </Link>
        <Link href="/dashboard/executors" className="py-4 text-slate-600 hover:text-[#0F172A]">
          Каталог исполнителей
        </Link>
      </nav>

      {/* Статистика из API */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx, duration: 0.4 }}
              className="rounded-2xl border border-[#E8ECF0] bg-white p-5"
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
                <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-[#0F172A]">{card.value}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Список проектов */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-[#0F172A]">Мои проекты</h2>

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
                onClick={() => loadProjects()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <RefreshCw size={14} /> Повторить
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-[14px] border border-[#DFE5EC] bg-white px-6 py-14 text-center sm:px-10">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF] font-mono font-bold text-[#2E5BFF]">
                01
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-[#0F172A]">
                Проектов пока нет
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Присоединитесь по токену, выданному заказчиком или менеджером ЦНТР, —
                проект сразу появится в этом списке.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => {
                const color = STATUS_COLORS[project.status] ?? '#94A3B8';
                return (
                  <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Link
                      href={`/dashboard/project/${project.id}`}
                      className="grid gap-4 rounded-[14px] border border-[#DFE5EC] bg-white p-5 transition hover:border-[#2E5BFF] md:grid-cols-[1fr_auto_auto]"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">ЦНТР-{project.id}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${color}15`, color }}
                          >
                            {STATUS_LABELS[project.status] ?? project.status}
                          </span>
                        </div>
                        <h3 className="mt-1 text-lg font-bold text-[#0F172A]">{project.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {project.category ?? 'Категория не указана'}
                          {project.description ? ` — ${project.description}` : ''}
                        </p>
                      </div>
                      <div className="md:text-right">
                        <div className="text-xs text-slate-500">Уровень УГТ</div>
                        <div className="mt-1 font-bold text-[#2E5BFF]">
                          УГТ {project.current_level} → {project.target_level}
                        </div>
                      </div>
                      <div className="flex items-center md:min-w-28 md:justify-end">
                        <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Вступление по токену */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
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
