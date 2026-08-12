"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  User,
  Users,
  X,
} from "lucide-react";
import type { ExecutorSummary } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type ViewMode = "cards" | "table";
type CatalogTab = "specialists" | "organizations";

const VIEW_KEY = "tz-executors-view";
const FILTERS_KEY = "tz-executors-filters";
const PAGE_SIZE = 12;

const ROLE_NAMES: Record<string, string> = {
  rd_executor: "R&D-исполнитель",
  scientific_org: "Научная организация",
  serial_manufacturer: "Серийный производитель",
};

const ROLE_COLORS: Record<string, string> = {
  rd_executor: "var(--tz-accent)",
  scientific_org: "var(--tz-success)",
  serial_manufacturer: "var(--tz-ugt-2)",
};

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "name_asc", label: "Имя (А–Я)" },
  { value: "name_desc", label: "Имя (Я–А)" },
  { value: "projects_desc", label: "Проектов: больше" },
  { value: "projects_asc", label: "Проектов: меньше" },
  { value: "role_asc", label: "Роль (А–Я)" },
];

interface SavedFilters {
  tab: CatalogTab;
  query: string;
  role: string;
  sort: string;
  page: number;
}

/** Компактная страница-список: от 1 до total, с многоточиями на длинных списках. */
function pageList(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const candidates = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...candidates]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) result.push("…");
    result.push(n);
    prev = n;
  }
  return result;
}

/** Русская плюрализация: 1 проект, 2 проекта, 5 проектов. */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

/** Максимум чипов компетенций на карточке. */
const MAX_COMPETENCIES = 4;

/**
 * Каталог исполнителей (тикет 05 internal-ux-redesign): два раздела
 * («Специалисты» / «Организации») поверх реальных API
 * /api/v1/executors/specialists и /api/v1/executors/organizations.
 * Переключатель «карточки/таблица», поиск, фильтр по роли, сортировка,
 * пагинация. Состояние — в URL (?tab&view&q&role&sort&page) и
 * localStorage (tz-executors-view / tz-executors-filters); URL приоритетнее.
 * Без mock-данных: пустые разделы показывают честное пустое состояние.
 */
export default function ExecutorsPage() {
  const { data: session } = useSession();

  const [tab, setTab] = useState<CatalogTab>("specialists");
  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);

  const [executors, setExecutors] = useState<ExecutorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const restored = useRef(false);
  const firstRender = useRef(true);

  // Гидрация из URL (приоритет) и localStorage — в эффекте (async-IIFE).
  useEffect(() => {
    (async () => {
      if (restored.current) return;
      restored.current = true;
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (tabParam === "specialists" || tabParam === "organizations") setTab(tabParam);
        if (params.get("view") === "table" || params.get("view") === "cards") {
          setView(params.get("view") as ViewMode);
        }
        const q = params.get("q");
        if (q != null) setQuery(q);
        const r = params.get("role");
        if (r != null) setRoleFilter(r);
        const s = params.get("sort");
        if (s != null) setSort(s);
        const p = Number(params.get("page"));
        if (Number.isInteger(p) && p > 1) setPage(p);

        if (params.size > 0) return;
        const savedView = window.localStorage.getItem(VIEW_KEY);
        if (savedView === "table" || savedView === "cards") setView(savedView);
        const saved = JSON.parse(
          window.localStorage.getItem(FILTERS_KEY) ?? "null",
        ) as Partial<SavedFilters> | null;
        if (saved && typeof saved === "object") {
          if (saved.tab === "specialists" || saved.tab === "organizations") setTab(saved.tab);
          if (typeof saved.query === "string") setQuery(saved.query);
          if (typeof saved.role === "string") setRoleFilter(saved.role);
          if (typeof saved.sort === "string") setSort(saved.sort);
          if (typeof saved.page === "number" && saved.page > 1) setPage(saved.page);
        }
      } catch {
        /* localStorage недоступен — остаёмся на значениях по умолчанию */
      }
    })();
  }, []);

  // Загрузка раздела каталога: серверный фильтр по роли (специалисты),
  // поиск/сортировка/пагинация — клиентские.
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const base =
          tab === "specialists" ? "/api/v1/executors/specialists" : "/api/v1/executors/organizations";
        const params = new URLSearchParams();
        if (roleFilter !== "all") params.set("role", roleFilter);
        const url = params.toString() ? `${base}?${params}` : base;
        const res = await fetch(`${API_URL}${url}`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: ExecutorSummary[] = await res.json();
        if (cancelled) return;
        setExecutors(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.accessToken, tab, roleFilter]);

  // Write-through: URL + localStorage (после первого рендера).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (tab !== "specialists") params.set("tab", tab);
    if (view !== "cards") params.set("view", view);
    const q = query.trim();
    if (q) params.set("q", q);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (sort !== "name_asc") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
    try {
      window.localStorage.setItem(VIEW_KEY, view);
      window.localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ tab, query, role: roleFilter, sort, page } satisfies SavedFilters),
      );
    } catch {
      /* ignore */
    }
  }, [tab, view, query, roleFilter, sort, page]);

  // Роли — из реальных данных текущего раздела.
  const roles = useMemo(() => {
    const seen = new Set<string>();
    for (const e of executors) if (e.role_slug) seen.add(e.role_slug);
    return [...seen];
  }, [executors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = executors;
    if (q) {
      list = list.filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          (e.organization ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "name_desc":
        sorted.sort((a, b) => b.full_name.localeCompare(a.full_name, "ru"));
        break;
      case "projects_desc":
        sorted.sort((a, b) => b.completed_projects - a.completed_projects);
        break;
      case "projects_asc":
        sorted.sort((a, b) => a.completed_projects - b.completed_projects);
        break;
      case "role_asc":
        sorted.sort((a, b) => a.role_name.localeCompare(b.role_name, "ru"));
        break;
      default:
        sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
    }
    return sorted;
  }, [executors, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasActiveFilters = query.trim() !== "" || roleFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setRoleFilter("all");
    setSort("name_asc");
    setPage(1);
  };

  const switchTab = (next: CatalogTab) => {
    setTab(next);
    setRoleFilter("all");
    setQuery("");
    setPage(1);
  };

  const switchView = (next: ViewMode) => setView(next);

  const filterSelectClass = "bg-transparent text-tz-fg outline-none";
  const filterWrapClass =
    "flex items-center gap-2 rounded-lg border border-tz-border bg-tz-surface px-3 py-2.5 text-sm text-tz-secondary";
  const viewButtonClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-tz-accent-soft text-tz-accent"
        : "text-tz-secondary hover:bg-tz-surface-2 hover:text-tz-fg"
    }`;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Каталог</p>
        <h1 className="tz-page-title mt-2">Каталог исполнителей</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          R&D-стартапы, научные организации и производители из реестра
          платформы — поиск, фильтр по роли, сортировка.
        </p>
      </div>

      {/* Переключатель разделов */}
      <div className="tz-tabs" role="tablist" aria-label="Разделы каталога">
        <button
          role="tab"
          aria-selected={tab === "specialists"}
          onClick={() => switchTab("specialists")}
          className={`tz-tab ${tab === "specialists" ? "tz-tab-active" : ""}`}
        >
          <User size={15} className="mr-1.5 inline" aria-hidden />
          Специалисты
          <span className="tz-tab-count">{loading ? "…" : executors.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "organizations"}
          onClick={() => switchTab("organizations")}
          className={`tz-tab ${tab === "organizations" ? "tz-tab-active" : ""}`}
        >
          <Building2 size={15} className="mr-1.5 inline" aria-hidden />
          Организации
          <span className="tz-tab-count">{loading ? "…" : executors.length}</span>
        </button>
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Поиск по имени или организации</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск по имени или организации…"
            className="tz-input pl-9"
          />
        </label>

        <label className={filterWrapClass}>
          <SlidersHorizontal size={15} className="shrink-0 text-tz-muted" aria-hidden />
          <span className="hidden text-tz-secondary sm:inline">Роль</span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по роли"
          >
            <option value="all">Все</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_NAMES[r] ?? r}
              </option>
            ))}
          </select>
        </label>

        <label className={filterWrapClass}>
          <span className="hidden text-tz-secondary sm:inline">Сортировка</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Сортировка"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {/* Переключатель «карточки / таблица» — выбор сохраняется в localStorage */}
        <div
          role="group"
          aria-label="Вид реестра"
          className="flex shrink-0 overflow-hidden rounded-lg border border-tz-border bg-tz-surface"
        >
          <button
            type="button"
            onClick={() => switchView("cards")}
            aria-pressed={view === "cards"}
            className={viewButtonClass(view === "cards")}
          >
            <LayoutGrid size={15} aria-hidden />
            <span className="hidden sm:inline">Карточки</span>
          </button>
          <button
            type="button"
            onClick={() => switchView("table")}
            aria-pressed={view === "table"}
            className={viewButtonClass(view === "table")}
          >
            <List size={15} aria-hidden />
            <span className="hidden sm:inline">Таблица</span>
          </button>
        </div>
      </div>

      {/* Строка результата и сброс фильтров */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tz-secondary">
          Найдено: <span className="font-semibold text-tz-fg">{filtered.length}</span>{" "}
          {pluralize(filtered.length, "запись", "записи", "записей")}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg"
          >
            <X size={14} aria-hidden />
            Сбросить фильтры
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-tz-accent border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-[14px] border border-tz-danger bg-tz-surface p-8 text-center">
          <h2 className="tz-section-title">Не удалось загрузить каталог</h2>
          <p className="mt-2 text-tz-secondary">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="tz-btn tz-btn-secondary mt-5"
          >
            Повторить
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center">
          <Users size={40} className="mx-auto mb-3 text-tz-muted" aria-hidden />
          <h2 className="tz-section-title">
            {executors.length === 0 ? "Раздел пока пуст" : "Ничего не найдено"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
            {executors.length === 0
              ? tab === "specialists"
                ? "Подтверждённых профилей специалистов в каталоге пока нет."
                : "Организаций в каталоге пока нет."
              : "По заданным условиям записей нет. Измените поиск или сбросьте фильтры."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="tz-btn tz-btn-secondary mt-5"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : view === "table" ? (
        /* Таблица */
        <div
          className="overflow-x-auto rounded-[14px] border border-tz-border bg-tz-surface"
          tabIndex={0}
          aria-label="Таблица каталога исполнителей — листается горизонтально"
        >
          <table className="tz-table w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-tz-border">
                <th scope="col" className="px-4 py-3">Имя</th>
                <th scope="col" className="px-4 py-3">Организация</th>
                <th scope="col" className="px-4 py-3">Роль</th>
                <th scope="col" className="px-4 py-3">Проектов</th>
                <th scope="col" className="px-4 py-3">Компетенции</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((exec) => (
                <tr key={exec.id}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-tz-fg">{exec.full_name}</span>
                    <span
                      className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        exec.id < 0
                          ? "bg-tz-accent-soft text-tz-accent"
                          : "bg-tz-success-soft text-tz-success"
                      }`}
                    >
                      {exec.id < 0 ? <Building2 size={10} aria-hidden /> : <User size={10} aria-hidden />}
                      {exec.id < 0 ? "Организация" : "Пользователь"}
                    </span>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-tz-secondary">
                    {exec.organization ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">{exec.role_name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-tz-fg">
                      {exec.completed_projects}
                    </span>
                  </td>
                  <td className="max-w-[240px] px-4 py-3 text-tz-secondary">
                    <span className="line-clamp-1">
                      {exec.competencies.length > 0 ? exec.competencies.join(", ") : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Компактные карточки БЕЗ радара: имя, роль, организация, проекты */
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((exec) => (
            <li key={exec.id} className="min-w-0">
              <div className="flex h-full flex-col gap-3 rounded-[14px] border border-tz-border bg-tz-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold text-white"
                    style={{ background: ROLE_COLORS[exec.role_slug] ?? "var(--tz-accent)" }}
                    aria-hidden
                  >
                    {exec.full_name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span
                    className="inline-flex max-w-[60%] items-center gap-1 truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{
                      background: `color-mix(in srgb, ${ROLE_COLORS[exec.role_slug] ?? "var(--tz-accent)"} 10%, transparent)`,
                      color: ROLE_COLORS[exec.role_slug] ?? "var(--tz-accent)",
                    }}
                  >
                    {exec.role_name}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-tz-fg" title={exec.full_name}>
                    {exec.full_name}
                  </h3>
                  {exec.organization && (
                    <p className="mt-1 truncate text-xs text-tz-secondary" title={exec.organization}>
                      {exec.organization}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-4 border-t border-tz-border pt-3 text-xs text-tz-muted">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle size={13} className="text-tz-success" aria-hidden />
                    {exec.completed_projects}{" "}
                    {pluralize(exec.completed_projects, "проект", "проекта", "проектов")}
                  </span>
                  {exec.competencies.length > 0 && (
                    <span className="truncate" title={exec.competencies.join(", ")}>
                      {exec.competencies.slice(0, MAX_COMPETENCIES).join(" · ")}
                      {exec.competencies.length > MAX_COMPETENCIES ? "…" : ""}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Пагинация */}
      {filtered.length > 0 && (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 border-t border-tz-border pt-4"
          aria-label="Пагинация"
        >
          <p className="text-sm text-tz-secondary">
            Показано{" "}
            <span className="font-semibold text-tz-fg">
              {(current - 1) * PAGE_SIZE + 1}–
              {Math.min(current * PAGE_SIZE, filtered.length)}
            </span>{" "}
            из {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
              aria-label="Предыдущая страница"
              className="grid h-10 w-10 place-items-center rounded-lg border border-tz-border text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            {pageList(current, totalPages).map((n, index) =>
              n === "…" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="grid h-10 w-10 place-items-center text-tz-muted"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === current ? "page" : undefined}
                  className={`grid h-10 min-w-10 place-items-center rounded-lg border px-2 text-sm font-medium transition ${
                    n === current
                      ? "border-tz-accent bg-tz-accent-soft text-tz-accent"
                      : "border-tz-border text-tz-secondary hover:bg-tz-surface-2 hover:text-tz-fg"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= totalPages}
              aria-label="Следующая страница"
              className="grid h-10 w-10 place-items-center rounded-lg border border-tz-border text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
