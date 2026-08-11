'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import JoinProjectForm from '@/components/join-project-form';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
import { AssessUgTCard } from "@/components/assess-ugt-card";

interface ControlPoint {
  id: number;
  title: string;
  description: string | null;
  point_type: string;
  status: string;
  decision: string | null;
}

interface ProjectDetail {
  project: {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    target_level: number;
    current_level: number;
    status: string;
    budget: number | null;
    created_by: number | null;
  };
  control_points: ControlPoint[];
  documents: Array<{ id: number; title: string; doc_type: string; status: string; version: number }>;
  members: Array<{ id: number; user_id: number; role_in_project: string; is_priority: boolean }>;
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  auto_confirmed: 'Подтверждён автоматически', active: 'В работе',
  review: 'На проверке',
  completed: 'Завершён',
  rejected: 'Отклонён',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft: 'var(--tz-neutral)',
  active: 'var(--tz-accent)',
  review: 'var(--tz-review)',
  completed: 'var(--tz-success)',
  rejected: 'var(--tz-danger)',
};

const CP_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает решения',
  in_review: 'На проверке',
  approved: 'Подтверждена',
  rejected: 'Отклонена',
  verified: 'Верифицирована',
  closed: 'Закрыта',
};

const CP_STATUS_COLORS: Record<string, string> = {
  pending: 'var(--tz-review)',
  in_review: 'var(--tz-accent)',
  approved: 'var(--tz-success)',
  rejected: 'var(--tz-danger)',
  verified: 'var(--tz-success)',
  closed: 'var(--tz-neutral)',
};

/** Точки, по которым решение уже принято — кнопки не показываем */
const DECIDED_STATUSES = new Set(['approved', 'rejected', 'verified', 'closed']);

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

export default function AuditorDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ projectId: number; cpId: number } | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Аудитор';

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
      // Список проектов теперь включает control_points (FE-004) — без N+1
      const list = (await res.json()) as ProjectDetail[];
      setProjects(list);
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

  /** Решение аудитора: Go (ТЭО обосновано) / No-Go (ТЭО не обосновано) */
  const decideControlPoint = useCallback(
    async (projectId: number, cpId: number, status: 'approved' | 'rejected') => {
      if (!session?.user?.accessToken) return;
      setDeciding({ projectId, cpId });
      setActionError(null);
      try {
        const decision = status === 'approved' ? 'ТЭО обосновано' : 'ТЭО не обосновано';
        const res = await fetch(
          `${API_URL}/api/v1/projects/${projectId}/control-points/${cpId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.user.accessToken}`,
            },
            body: JSON.stringify({ status, decision }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(extractError(data, `Ошибка принятия решения (${res.status}).`));
        }
        setProjects((prev) =>
          prev.map((d) =>
            d.project.id === projectId
              ? {
                  ...d,
                  control_points: d.control_points.map((cp) =>
                    cp.id === cpId ? { ...cp, status, decision } : cp,
                  ),
                }
              : d,
          ),
        );
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Не удалось принять решение.');
      } finally {
        setDeciding(null);
      }
    },
    [session],
  );

  const pendingPoints = projects.reduce(
    (acc, d) => acc + d.control_points.filter((cp) => !DECIDED_STATUSES.has(cp.status)).length,
    0,
  );
  const goCount = projects.reduce(
    (acc, d) => acc + d.control_points.filter((cp) => cp.status === 'approved' || cp.status === 'verified').length,
    0,
  );
  const noGoCount = projects.reduce(
    (acc, d) => acc + d.control_points.filter((cp) => cp.status === 'rejected').length,
    0,
  );

  const statCards = [
    { label: 'Проекты на аудите', value: projects.length, icon: ClipboardList, color: 'var(--tz-accent)' },
    { label: 'Ожидают Go/No-Go', value: pendingPoints, icon: ShieldCheck, color: 'var(--tz-review)' },
    { label: 'Go (ТЭО обосновано)', value: goCount, icon: ThumbsUp, color: 'var(--tz-success)' },
    { label: 'No-Go (ТЭО не обосновано)', value: noGoCount, icon: ThumbsDown, color: 'var(--tz-danger)' },
  ];

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Рабочий стол аудитора
        </p>
        <h1 className="tz-page-title mt-2 text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Оценивайте контрольные точки проектов (в первую очередь КТ-1) и принимайте
          решение Go/No-Go по технико-экономическому обоснованию.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg">
          Аудит проектов
        </span>
        <Link href="/dashboard/technologies" className="py-4 text-tz-secondary hover:text-tz-fg">
          Реестр технологий
        </Link>
      </nav>

      {/* Статистика */}
      {/* Экспресс-оценка УГТ — тикет 26: доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

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

      {actionError && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Проекты со списком КТ */}
        <div>
          <h2 className="tz-card-title mb-4 text-tz-fg">Проекты</h2>

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
          ) : projects.length === 0 ? (
            <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)]">
                <ClipboardList size={22} className="text-[var(--tz-accent)]" />
              </div>
              <h2 className="tz-section-title mt-5 text-tz-fg">
                Проектов на аудите нет
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
                Присоединитесь по токену к проекту, контрольные точки которого нужно
                проверить, — и они появятся в этом списке.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {projects.map((detail) => {
                const p = detail.project;
                const color = PROJECT_STATUS_COLORS[p.status] ?? 'var(--tz-neutral)';
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-tz-card-border bg-tz-surface p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${color}15`, color }}
                          >
                            {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/project/${p.id}`}
                          className="mt-1 block text-lg font-bold text-tz-fg transition hover:text-[var(--tz-accent)]"
                        >
                          {p.name}
                        </Link>
                        <p className="mt-1 text-sm text-tz-secondary">
                          {p.category ?? 'Категория не указана'} · УГТ {p.current_level} → {p.target_level}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-tz-muted">
                        <FileText size={14} className="text-[var(--tz-ugt-2)]" />
                        {detail.documents.length} док.
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {detail.control_points.length === 0 ? (
                        <p className="text-sm text-tz-muted">Контрольные точки не заданы</p>
                      ) : (
                        detail.control_points.map((cp) => {
                          const isGate = cp.point_type === 'gate' && cp.title.includes('КТ-1');
                          const cpColor = CP_STATUS_COLORS[cp.status] ?? 'var(--tz-neutral)';
                          const isDecided = DECIDED_STATUSES.has(cp.status);
                          const isBusy = deciding?.projectId === p.id && deciding?.cpId === cp.id;
                          return (
                            <div
                              key={cp.id}
                              className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                isGate
                                  ? 'border-[var(--tz-accent)]/40 bg-[var(--tz-soft)]'
                                  : 'border-tz-border bg-tz-soft'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-tz-fg">{cp.title}</p>
                                  {isGate ? (
                                    <span className="rounded-full bg-[var(--tz-accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                                      КТ-1 · Ворота
                                    </span>
                                  ) : (
                                    <span className="rounded bg-tz-soft px-2 py-0.5 text-[11px] text-tz-secondary">
                                      {cp.point_type === 'gate' ? 'Ворота' : cp.point_type}
                                    </span>
                                  )}
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{ background: `${cpColor}15`, color: cpColor }}
                                  >
                                    {CP_STATUS_LABELS[cp.status] ?? cp.status}
                                  </span>
                                </div>
                                {cp.description && (
                                  <p className="mt-1 text-sm text-tz-muted">{cp.description}</p>
                                )}
                                {cp.decision && (
                                  <p className="mt-1 text-xs font-medium text-tz-muted">
                                    Решение: {cp.decision}
                                  </p>
                                )}
                              </div>
                              {!isDecided && (
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    onClick={() => decideControlPoint(p.id, cp.id, 'approved')}
                                    disabled={deciding !== null}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tz-success)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--tz-success)] disabled:opacity-50"
                                  >
                                    {isBusy ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <CheckCircle2 size={13} />
                                    )}
                                    Go
                                  </button>
                                  <button
                                    onClick={() => decideControlPoint(p.id, cp.id, 'rejected')}
                                    disabled={deciding !== null}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-tz-danger-soft px-3.5 py-2 text-xs font-semibold text-tz-danger transition hover:bg-tz-danger-soft disabled:opacity-50"
                                  >
                                    <XCircle size={13} />
                                    No-Go
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Вступление по токену */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-tz-card-border bg-tz-surface">
              <Loader2 size={22} className="animate-spin text-[var(--tz-accent)]" />
            </div>
          ) : (
            <JoinProjectForm />
          )}
        </aside>
      </div>
    </section>
  );
}
