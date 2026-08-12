"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Building2,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
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

const UGT_OPTIONS = [7, 8, 9];

/**
 * Рабочий стол инвестора (тикет 06 internal-ux-redesign).
 * Единый паттерн кабинета: заголовок, статистика (из данных реестра),
 * фильтры и реестр технологий (данные, только для чтения), блок действий
 * (оценка УГТ) и честная подсказка следующего шага. Без mock-success.
 */
export default function InvestorDashboard() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [minLevel, setMinLevel] = useState<number>(7);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Инвестор";

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
      setError(e instanceof Error ? e.message : "Не удалось загрузить реестр технологий.");
    } finally {
      setLoading(false);
    }
  }, [session, minLevel]);

  useEffect(() => {
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
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.organization?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [technologies, categoryFilter, search]);

  /** Честная статистика — производные от данных реестра. */
  const stats = useMemo(() => {
    const categoriesCount = new Set(technologies.map((t) => t.category).filter(Boolean)).size;
    const highLevel = technologies.filter((t) => t.current_level >= 8).length;
    const progress =
      technologies.length === 0
        ? 0
        : Math.round(
            technologies.reduce(
              (acc, t) => acc + (t.target_level > 0 ? Math.round((t.current_level / t.target_level) * 100) : 0),
              0,
            ) / technologies.length,
          );
    return { count: technologies.length, categories: categoriesCount, highLevel, progress };
  }, [technologies]);

  const statCards = [
    { label: "Технологии в реестре", value: stats.count, icon: TrendingUp, color: "var(--tz-accent)" },
    { label: "Категории", value: stats.categories, icon: Layers, color: "var(--tz-success)" },
    { label: "УГТ 8 и выше", value: stats.highLevel, icon: Sparkles, color: "var(--tz-review)" },
    { label: "Средняя готовность", value: stats.count === 0 ? "—" : `${stats.progress}%`, icon: Activity, color: "var(--tz-ugt-2)" },
  ];

  return (
    <section>
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол инвестора</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Изучайте реестр технологий платформы: уровень зрелости УГТ, организация-
          разработчик и перспективы внедрения. Реестр доступен только для чтения.
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

      {/* Действия: экспресс-оценка УГТ (доступна любой роли) */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      {/* Фильтры реестра */}
      <div className="mt-8 rounded-2xl border border-tz-card-border bg-tz-surface p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию…"
              aria-label="Поиск по названию"
              className="w-full rounded-xl border border-tz-border bg-tz-surface py-2.5 pl-9 pr-3 text-sm text-tz-fg outline-none transition placeholder:text-tz-muted focus:border-tz-accent"
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
              className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg outline-none transition focus:border-tz-accent"
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
              className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg outline-none transition focus:border-tz-accent"
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

      {/* Данные: реестр технологий */}
      <div className="mt-6">
        <h2 className="tz-card-title">
          Реестр технологий <span className="text-sm font-normal text-tz-muted">({filtered.length})</span>
        </h2>

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
        ) : filtered.length === 0 ? (
          <div className="tz-card tz-empty mt-4">
            <span className="tz-empty-icon">
              <TrendingUp size={22} />
            </span>
            <h2 className="tz-empty-title">Технологии не найдены</h2>
            <p className="tz-empty-text">
              Измените параметры фильтров или дождитесь появления новых технологий в реестре.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((tech) => {
              const progress =
                tech.target_level > 0
                  ? Math.min(100, Math.round((tech.current_level / tech.target_level) * 100))
                  : 0;
              return (
                <div key={tech.id} className="tz-card tz-card-hover p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-tz-fg">{tech.name}</h3>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: `${PUBLISHED_COLOR}15`, color: PUBLISHED_COLOR }}
                    >
                      В реестре
                    </span>
                  </div>

                  {/* Зрелость: прогресс current → target */}
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-tz-muted">
                        <Activity size={13} className="text-tz-accent" />
                        Зрелость УГТ
                      </span>
                      <span className="font-semibold text-tz-accent">
                        УГТ {tech.current_level} → {tech.target_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-tz-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-tz-accent to-tz-success transition-all duration-500"
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
                        {tech.budget.toLocaleString("ru-RU")} млн ₽
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Следующий шаг: честная подсказка без мёртвых кнопок */}
      <div className="mt-8 rounded-2xl border border-tz-card-border bg-tz-surface p-5">
        <p className="text-sm text-tz-secondary">
          <span className="font-semibold text-tz-fg">Следующий шаг.</span> Реестр доступен только для
          чтения: заинтересовавшую технологию можно обсудить с менеджером ЦНТР —
          контакты вашего куратора указаны в уведомлениях платформы.
        </p>
      </div>
    </section>
  );
}
