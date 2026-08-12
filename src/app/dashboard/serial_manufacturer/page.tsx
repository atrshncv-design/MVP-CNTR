"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Building2,
  Factory,
  Layers,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import JoinProjectForm from "@/components/join-project-form";
import { AssessUgTCard } from "@/components/assess-ugt-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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

const PUBLISHED_COLOR = "var(--tz-success)";

/**
 * Рабочий стол серийного производителя (тикет 06 internal-ux-redesign).
 * Единый паттерн кабинета: заголовок, статистика (из данных реестра),
 * список технологий УГТ 7+ (данные), боковая колонка — действия и следующий
 * шаг (оценка УГТ + вступление по токену). Без mock-success.
 */
export default function SerialManufacturerDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Серийный производитель";

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
      setError(e instanceof Error ? e.message : "Не удалось загрузить технологии.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      await loadTechnologies();
    })();
  }, [loadTechnologies]);

  /** Честная статистика — производные от реальных данных реестра. */
  const stats = useMemo(() => {
    const categories = new Set(technologies.map((t) => t.category).filter(Boolean));
    const orgs = new Set(technologies.map((t) => t.organization).filter(Boolean));
    const progress =
      technologies.length === 0
        ? 0
        : Math.round(
            technologies.reduce(
              (acc, t) => acc + (t.target_level > 0 ? Math.round((t.current_level / t.target_level) * 100) : 0),
              0,
            ) / technologies.length,
          );
    return { count: technologies.length, categories: categories.size, orgs: orgs.size, progress };
  }, [technologies]);

  const statCards = [
    { label: "Технологии УГТ 7+", value: stats.count, icon: Factory, color: "var(--tz-accent)" },
    { label: "Категории", value: stats.categories, icon: Layers, color: "var(--tz-success)" },
    { label: "Организации-разработчики", value: stats.orgs, icon: Building2, color: "var(--tz-review)" },
    { label: "Средняя готовность", value: stats.count === 0 ? "—" : `${stats.progress}%`, icon: Activity, color: "var(--tz-ugt-2)" },
  ];

  return (
    <section>
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол серийного производителя</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Здесь представлены технологии уровня УГТ 7 и выше, готовые к опытному
          образцу, квалификации и серийному выпуску.
        </p>
      </div>

      {/* Данные: статистика из данных реестра */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx, duration: 0.4 }}
              className="tz-card tz-stat p-5"
            >
              <div className="tz-stat-label">
                {card.label}
                <span className="tz-stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-tz-soft" />
              ) : (
                <p className="tz-stat-value">{card.value}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Данные (реестр) + действия/следующий шаг (боковая колонка) */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="tz-card-title">Технологии УГТ 7+</h2>
              <p className="mt-1 text-sm text-tz-muted">
                Опубликованные проекты, подтверждённые менеджером ЦНТР
              </p>
            </div>
          </div>

          {loading ? (
            <div className="tz-card mt-4 p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-tz-soft" />
              <div className="mt-4 h-16 animate-pulse rounded bg-tz-soft" />
            </div>
          ) : error ? (
            <div className="tz-card tz-empty mt-4">
              <AlertCircle className="text-tz-danger" size={32} />
              <p className="tz-empty-title">{error}</p>
              <button className="tz-btn tz-btn-secondary mt-6" onClick={() => void loadTechnologies()}>
                <RefreshCw size={15} /> Повторить
              </button>
            </div>
          ) : technologies.length === 0 ? (
            <div className="tz-card tz-empty mt-4">
              <span className="tz-empty-icon">
                <Factory size={22} />
              </span>
              <h2 className="tz-empty-title">Технологий УГТ 7+ пока нет</h2>
              <p className="tz-empty-text">
                Как только технология достигнет уровня опытного образца, она появится
                в этом реестре для оценки готовности к серийному выпуску.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {technologies.map((tech) => {
                const progress =
                  tech.target_level > 0
                    ? Math.min(100, Math.round((tech.current_level / tech.target_level) * 100))
                    : 0;
                return (
                  <div
                    key={tech.id}
                    className="tz-card tz-card-hover p-5"
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
                        <h3 className="tz-card-title mt-1.5">{tech.name}</h3>
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-tz-muted">
                          {tech.organization && (
                            <span className="flex items-center gap-1.5">
                              <Building2 size={14} className="text-[var(--tz-ugt-2)]" />
                              {tech.organization}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Activity size={14} className="text-tz-accent" />
                            УГТ {tech.current_level} / {tech.target_level}
                          </span>
                          {tech.budget != null && (
                            <span className="flex items-center gap-1.5">
                              <Wallet size={14} className="text-tz-muted" />
                              {tech.budget.toLocaleString("ru-RU")} млн ₽
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-36 shrink-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-tz-muted">Готовность</span>
                          <span className="font-semibold text-tz-accent">{progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tz-surface-2">
                          <div
                            className="h-full rounded-full bg-tz-accent transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Действия и следующий шаг */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <AssessUgTCard />
          {loading ? (
            <div className="flex h-40 items-center justify-center tz-card">
              <Loader2 size={22} className="animate-spin text-tz-accent" />
            </div>
          ) : (
            <JoinProjectForm />
          )}
        </aside>
      </div>
    </section>
  );
}
