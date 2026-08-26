'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Building2,
  Factory,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import JoinProjectForm from '@/components/join-project-form';

import { AssessUgTCard } from "@/components/assess-ugt-card";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";

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

export default function SerialManufacturerDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Серийный производитель';

  const loadTechnologies = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/registry?ugt_min=7`, {
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
  }, [session]);

  useEffect(() => {
    // setState внутри loadTechnologies выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadTechnologies();
    })();
  }, [loadTechnologies]);

  return (
    <section>
      {/* Hero-блок в стиле ЛК ГК */}
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Рабочий стол серийного производителя
        </p>
        <h1 className="tz-page-title mt-2 text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Здесь представлены технологии уровня УГТ 7 и выше, готовые к опытному
          образцу, квалификации и серийному выпуску.
        </p>
      </div>

      {/* Экспресс-оценка УГТ — тикет 26: доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg">
          Технологии УГТ 7+
        </span>
        <a href="#join" className="py-4 text-tz-secondary hover:text-tz-fg">
          Присоединиться к проекту
        </a>
        <a href="#registry" className="py-4 text-tz-secondary hover:text-tz-fg">
          Каталог исполнителей
        </a>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Реестр технологий УГТ 7+ */}
        <div id="registry">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="tz-card-title text-tz-fg">Технологии УГТ 7+</h2>
              <p className="text-sm text-tz-muted">Опубликованные проекты, подтверждённые менеджером ЦНТР</p>
            </div>
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
                onClick={() => loadTechnologies()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <RefreshCw size={14} /> Повторить
              </button>
            </div>
          ) : technologies.length === 0 ? (
            <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)]">
                <Factory size={22} className="text-[var(--tz-accent)]" />
              </div>
              <h2 className="tz-section-title mt-5 text-tz-fg">
                Технологий УГТ 7+ пока нет
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
                Как только технология достигнет уровня опытного образца, она появится
                в этом реестре для оценки готовности к серийному выпуску.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {technologies.map((tech) => {
                const progress =
                  tech.target_level > 0
                    ? Math.round((tech.current_level / tech.target_level) * 100)
                    : 0;
                return (
                  <motion.div
                    key={tech.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-tz-card-border bg-tz-surface p-5 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-tz-muted">Т-{tech.id}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: `${PUBLISHED_COLOR}15`, color: PUBLISHED_COLOR }}
                          >
                            В реестре
                          </span>
                          {tech.category && (
                            <span className="rounded-full bg-tz-surface-2 px-2 py-0.5 text-[11px] text-tz-muted">
                              {tech.category}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 tz-card-title text-tz-fg">{tech.name}</h3>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-tz-muted">
                          {tech.organization && (
                            <span className="flex items-center gap-1.5">
                              <Building2 size={14} className="text-[var(--tz-ugt-2)]" />
                              {tech.organization}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Activity size={14} className="text-[var(--tz-accent)]" />
                            УГТ {tech.current_level} / {tech.target_level}
                          </span>
                          {tech.budget != null && (
                            <span className="flex items-center gap-1.5">
                              <Wallet size={14} className="text-tz-muted" />
                              {tech.budget.toLocaleString('ru-RU')} млн ₽
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-tz-muted">Готовность</span>
                          <span className="font-semibold text-[var(--tz-accent)]">{progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tz-surface-2">
                          <div
                            className="h-full rounded-full bg-[var(--tz-accent)] transition-all duration-500"
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
