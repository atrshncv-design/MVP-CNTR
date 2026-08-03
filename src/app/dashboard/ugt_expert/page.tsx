'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, FileCheck, FolderKanban, Loader2, RefreshCw } from 'lucide-react';
import JoinProjectForm from '@/components/join-project-form';
import { AssessUgTCard } from '@/components/assess-ugt-card';
import VerificationDocsPanel from '@/components/verification-docs-panel';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface JoinedProject {
  id: number;
  name: string;
  current_level: number;
  target_level: number;
  docs_count: number;
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

export default function RegulatingOrganizationDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<JoinedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Регулирующая организация';

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
      const list = (await res.json()) as Array<{ id: number }>;
      // Параллельно берём карточки, чтобы посчитать верифицирующие документы по каждому проекту
      const details = await Promise.all(
        list.map(async (p) => {
          const dres = await fetch(`${API_URL}/api/v1/projects/${p.id}`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          });
          if (!dres.ok) return null;
          const data = (await dres.json()) as {
            project: { id: number; name: string; current_level: number; target_level: number };
            verification_documents?: Array<{ id: number }>;
          };
          return {
            id: data.project.id,
            name: data.project.name,
            current_level: data.project.current_level,
            target_level: data.project.target_level,
            docs_count: (data.verification_documents ?? []).length,
          };
        }),
      );
      setProjects(details.filter((d): d is JoinedProject => d !== null));
    } catch (e) {
      setError(extractError(e, 'Не удалось загрузить проекты.'));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      await loadProjects();
    })();
  }, [loadProjects]);

  const totalDocs = projects.reduce((acc, p) => acc + p.docs_count, 0);

  const statCards = [
    { label: 'Проекты', value: projects.length, icon: FolderKanban, color: '#2E5BFF' },
    { label: 'Верифицирующие документы', value: totalDocs, icon: FileCheck, color: '#10B981' },
  ];

  return (
    <section>
      {/* Hero-блок */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-slate-500">
          Рабочий стол регулирующей организации
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Присоединяйтесь к карточке проекта по токену TZ-XXXXXX и добавляйте
          документы подтверждения УГТ — они станут основанием для решения менеджера ЦНТР.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[#2E5BFF] py-4 font-semibold text-tz-fg">
          Документы подтверждения
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
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-tz-fg">
                  {card.value}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
          <button
            onClick={() => loadProjects()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
          >
            <RefreshCw size={13} /> Повторить
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Проекты, к которым присоединилась организация */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-tz-fg">Мои проекты</h2>

          {loading ? (
            <div className="rounded-[14px] border border-tz-border bg-tz-surface p-6">
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
            <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF0FF]">
                <FolderKanban size={22} className="text-[#2E5BFF]" />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-tz-fg">
                Пока нет проектов
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Присоединитесь к карточке проекта по токену TZ — и она появится
                в этом списке. После вступления вам станет доступна загрузка
                верифицирующих документов.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {projects.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-tz-card-border bg-tz-surface p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">ЦНТР-{p.id}</span>
                        <span className="rounded-full bg-[#EAF0FF] px-2 py-0.5 text-[11px] font-medium text-[#2E5BFF]">
                          УГТ {p.current_level} → {p.target_level}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          {p.docs_count} доказ.
                      </span>
                      </div>
                      <Link
                        href={`/dashboard/project/${p.id}`}
                        className="mt-1 block text-lg font-bold text-tz-fg transition hover:text-[#2E5BFF]"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <Link
                      href={`/dashboard/project/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E5BFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E4BD8]"
                    >
                      <FileCheck size={15} /> Документы проекта
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <VerificationDocsPanel />
          </div>
        </div>

        {/* Вступление по токену */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-tz-card-border bg-tz-surface">
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
