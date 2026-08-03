"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Beaker,
  Briefcase,
  Building2,
  Clock,
  Filter,
  Layers,
  RotateCcw,
  Rocket,
  Search,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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

interface ProjectSummary {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  current_level: number;
  target_level: number;
  budget: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активен",
  review: "На проверке",
  completed: "Завершён",
  rejected: "Отклонён",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "tz-badge-neutral",
  active: "tz-badge-accent",
  review: "tz-badge-review",
  completed: "tz-badge-success",
  rejected: "tz-badge-danger",
};

/** Категории из API реестра технологий */
const CATEGORIES = ["AI/ML", "НИОКТР"];

/** Уровни УГТ по ГОСТ Р 58048-2017 (1–9) */
const UGT_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);

const levelOptions = (): Array<{ value: string; label: string }> => [
  { value: "all", label: "Любой" },
  ...UGT_LEVELS.map((l) => ({ value: String(l), label: `УГТ ${l}` })),
];

type RegistryTab = "projects" | "technologies";

function formatBudget(budget: number | null): string {
  if (budget == null) return "Бюджет не указан";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

export default function TechnologiesPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<RegistryTab>("projects");

  // Реестр проектов
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Реестр технологий УГТ 7+
  const [technologies, setTechnologies] = useState<Technology[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [minLevel, setMinLevel] = useState<string>(tab === "technologies" ? "7" : "all");
  const [maxLevel, setMaxLevel] = useState<string>("all");

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (categoryFilter !== "all") params.set("category", categoryFilter);
        if (minLevel !== "all") params.set("min_level", minLevel);
        if (maxLevel !== "all") params.set("max_level", maxLevel);

        const [projectsRes, techRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/projects`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          }),
          fetch(`${API_URL}/api/v1/technologies?${params}`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          }),
        ]);
        if (projectsRes.ok) setProjects(await projectsRes.json());
        if (techRes.ok) setTechnologies(await techRes.json());
      } catch {
        // При ошибке оставляем текущие данные
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [session, statusFilter, categoryFilter, minLevel, maxLevel]);

  // Клиентская фильтрация поверх серверной: поиск + диапазон УГТ (проекты)
  const filteredProjects = projects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.description?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (minLevel !== "all" && p.current_level < Number(minLevel)) return false;
    if (maxLevel !== "all" && p.current_level > Number(maxLevel)) return false;
    return true;
  });

  const filteredTechnologies = technologies.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !t.description?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (minLevel !== "all" && t.current_level < Number(minLevel)) return false;
    if (maxLevel !== "all" && t.current_level > Number(maxLevel)) return false;
    return true;
  });

  const hasFilters = statusFilter !== "all" || categoryFilter !== "all" ||
    minLevel !== "all" || maxLevel !== "all" || search !== "";

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setMinLevel(tab === "technologies" ? "7" : "all");
    setMaxLevel("all");
  };

  const switchTab = (next: RegistryTab) => {
    setTab(next);
    setStatusFilter("all");
    setCategoryFilter("all");
    setMinLevel(next === "technologies" ? "7" : "all");
    setMaxLevel("all");
    setSearch("");
  };

  const list = tab === "projects" ? filteredProjects : filteredTechnologies;

  return (
    <div data-od-id="registries">
      {/* Hero */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Реестры платформы</p>
        <h1 className="tz-page-title mt-2">Реестры проектов и технологий</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Общая витрина проектов платформы и реестр технологий с уровнем УГТ 7+ —
          по ГОСТ Р 58048-2017. Фильтры: область технологии, статус, диапазон УГТ, бюджет.
        </p>
      </div>

      {/* Переключатель реестров — тикет 29 */}
      <div className="tz-tabs mt-8" role="tablist" aria-label="Реестры">
        <button
          role="tab"
          aria-selected={tab === "projects"}
          onClick={() => switchTab("projects")}
          className={`tz-tab ${tab === "projects" ? "tz-tab-active" : ""}`}
        >
          <Layers size={15} className="mr-1.5 inline" aria-hidden="true" />
          Проекты
          <span className="tz-tab-count">{loading ? "…" : projects.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "technologies"}
          onClick={() => switchTab("technologies")}
          className={`tz-tab ${tab === "technologies" ? "tz-tab-active" : ""}`}
        >
          <Rocket size={15} className="mr-1.5 inline" aria-hidden="true" />
          Технологии УГТ 7+
          <span className="tz-tab-count">{loading ? "…" : technologies.length}</span>
        </button>
      </div>

      {/* Фильтры */}
      <div className="mt-6 space-y-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Поиск по названию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="tz-input pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-tz-muted" aria-hidden="true" />
          {tab === "projects" && (
            <>
              <span className="tz-eyebrow mr-1">Статус:</span>
              {["all", "draft", "active", "review", "completed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`tz-chip ${statusFilter === s ? "tz-chip-active" : ""}`}
                >
                  {STATUS_LABELS[s] ?? s}
                </button>
              ))}
              <span className="tz-eyebrow ml-2 mr-1">Категория:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="tz-select w-auto"
              >
                <option value="all">Все</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </>
          )}
          <span className="tz-eyebrow ml-2 mr-1">УГТ от:</span>
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value)}
            className="tz-select w-auto"
          >
            {levelOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="tz-eyebrow mr-1">до:</span>
          <select
            value={maxLevel}
            onChange={(e) => setMaxLevel(e.target.value)}
            className="tz-select w-auto"
          >
            {levelOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="tz-btn tz-btn-ghost tz-btn-sm"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Контент */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-tz-accent border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <div className="tz-card tz-empty mt-6">
          <span className="tz-empty-icon">
            <Beaker size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">
            {tab === "projects" ? "Проектов не найдено" : "Технологий УГТ 7+ пока нет"}
          </h2>
          <p className="tz-empty-text">
            {tab === "projects"
              ? "Проекты появляются в реестре после апрува карточки менеджером ЦНТР."
              : "Технология попадает в этот реестр автоматически при подтверждении уровня УГТ 7 и выше."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((item, idx) => {
            if (tab === "projects") {
              const p = item as ProjectSummary;
              const badge = STATUS_BADGE[p.status] ?? "tz-badge-neutral";
              return (
                <motion.div
                  key={`p-${p.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * idx, duration: 0.3 }}
                  className="tz-card tz-card-hover p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span>
                    <span className={`tz-badge ${badge}`}>{STATUS_LABELS[p.status] ?? p.status}</span>
                    {p.category && <span className="tz-badge tz-badge-neutral">{p.category}</span>}
                  </div>
                  <h3 className="font-bold text-tz-fg">{p.name}</h3>
                  {p.description && (
                    <p className="mb-3 mt-1 text-sm text-tz-muted line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-tz-muted">
                    <span className="flex items-center gap-1.5">
                      <Activity size={14} className="text-tz-accent" aria-hidden="true" />
                      <span className="tz-ugt">УГТ {p.current_level}</span>
                      <span aria-hidden="true">→</span>
                      <span className="tz-ugt">{p.target_level}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={14} className="text-tz-muted" aria-hidden="true" />
                      {formatBudget(p.budget)}
                    </span>
                  </div>
                </motion.div>
              );
            }
            const t = item as Technology;
            const badge = STATUS_BADGE[t.status] ?? "tz-badge-neutral";
            const progress = t.target_level > 0
              ? Math.min(100, Math.round((t.current_level / t.target_level) * 100))
              : 0;
            return (
              <motion.div
                key={`t-${t.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * idx, duration: 0.3 }}
                className="tz-card tz-card-hover p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="font-bold text-tz-fg">{t.name}</h3>
                  <span className={`tz-badge ${badge}`}>{STATUS_LABELS[t.status] ?? t.status}</span>
                </div>
                {t.description && (
                  <p className="mb-3 text-sm text-tz-muted line-clamp-2">{t.description}</p>
                )}
                {t.organization && (
                  <p className="mb-3 flex items-center gap-1.5 text-sm text-tz-muted">
                    <Building2 size={14} className="shrink-0 text-tz-success" aria-hidden="true" />
                    <span>
                      Исполнитель: <span className="font-medium text-tz-secondary">{t.organization}</span>
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-tz-muted">
                  <span className="flex items-center gap-1.5">
                    <Activity size={14} className="text-tz-accent" aria-hidden="true" />
                    <span className="tz-ugt tz-ugt-strong">УГТ {t.current_level}</span>
                    <span aria-hidden="true">→</span>
                    <span className="tz-ugt">{t.target_level}</span>
                  </span>
                  {t.category && (
                    <span className="tz-badge tz-badge-neutral">
                      <Beaker size={11} aria-hidden="true" />
                      {t.category}
                    </span>
                  )}
                  {t.created_by_name && (
                    <span className="flex items-center gap-1">
                      <Clock size={14} className="text-tz-muted" aria-hidden="true" />
                      {t.created_by_name}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-tz-muted">Прогресс УГТ</span>
                    <span className="font-mono text-xs font-medium text-tz-accent">{progress}%</span>
                  </div>
                  <div className="tz-progress">
                    <div className="tz-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
