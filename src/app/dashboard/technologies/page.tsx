"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { RegistryProject } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type ViewMode = "cards" | "table";
type RegistryTab = "projects" | "technologies";

const VIEW_KEY = "tz-registries-view";
const FILTERS_KEY = "tz-registries-filters";
const PAGE_SIZE = 9;

const UGT_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "level_desc", label: "УГТ: выше уровень" },
  { value: "level_asc", label: "УГТ: ниже уровень" },
  { value: "name_asc", label: "Название (А–Я)" },
  { value: "name_desc", label: "Название (Я–А)" },
  { value: "budget_desc", label: "Бюджет: больше" },
  { value: "budget_asc", label: "Бюджет: меньше" },
  { value: "date_desc", label: "Сначала новые" },
  { value: "org_asc", label: "Организация (А–Я)" },
];

interface SavedFilters {
  tab: RegistryTab;
  query: string;
  category: string;
  ugtMin: string;
  ugtMax: string;
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ru-RU");
}

function formatBudget(budget: number | null): string {
  if (budget == null) return "Бюджет не указан";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

/** ugtClass — цветной бейдж уровня УГТ по ГОСТ Р 58048-2017. */
const ugtClass = (level: number) => `tz-ugt tz-ugt-${Math.min(9, Math.max(1, level))}`;

/**
 * Реестры проектов и технологий (тикет 05 internal-ux-redesign):
 * два таба («Проекты» / «Технологии УГТ 7+») поверх публичного реестра
 * /api/v1/projects/registry — без выдуманных полей (у API нет status —
 * показываем только реальные поля). Переключатель «карточки/таблица»,
 * поиск, фильтры (категория, диапазон УГТ), сортировка, пагинация.
 * Состояние — в URL (?tab&view&q&category&ugt_min&ugt_max&sort&page)
 * и дублируется в localStorage (tz-registries-view / tz-registries-filters);
 * URL приоритетнее. Карточки компактные, без радара; подробности — на
 * странице проекта /dashboard/project/[id] (тикет 04).
 */
export default function TechnologiesPage() {
  const { data: session } = useSession();

  const [tab, setTab] = useState<RegistryTab>("projects");
  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [ugtMin, setUgtMin] = useState("all");
  const [ugtMax, setUgtMax] = useState("all");
  const [sort, setSort] = useState("level_desc");
  const [page, setPage] = useState(1);

  const [projects, setProjects] = useState<RegistryProject[]>([]);
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
        if (tabParam === "projects" || tabParam === "technologies") setTab(tabParam);
        if (params.get("view") === "table" || params.get("view") === "cards") {
          setView(params.get("view") as ViewMode);
        }
        const q = params.get("q");
        if (q != null) setQuery(q);
        const cat = params.get("category");
        if (cat != null) setCategory(cat);
        const min = params.get("ugt_min");
        if (min != null) setUgtMin(min);
        const max = params.get("ugt_max");
        if (max != null) setUgtMax(max);
        const s = params.get("sort");
        if (s != null) setSort(s);
        const p = Number(params.get("page"));
        if (Number.isInteger(p) && p > 1) setPage(p);

        if (params.size > 0) return;
        // URL пуст — восстанавливаем сохранённые фильтры из localStorage.
        const savedView = window.localStorage.getItem(VIEW_KEY);
        if (savedView === "table" || savedView === "cards") setView(savedView);
        const saved = JSON.parse(
          window.localStorage.getItem(FILTERS_KEY) ?? "null",
        ) as Partial<SavedFilters> | null;
        if (saved && typeof saved === "object") {
          if (saved.tab === "projects" || saved.tab === "technologies") setTab(saved.tab);
          if (typeof saved.query === "string") setQuery(saved.query);
          if (typeof saved.category === "string") setCategory(saved.category);
          if (typeof saved.ugtMin === "string") setUgtMin(saved.ugtMin);
          if (typeof saved.ugtMax === "string") setUgtMax(saved.ugtMax);
          if (typeof saved.sort === "string") setSort(saved.sort);
          if (typeof saved.page === "number" && saved.page > 1) setPage(saved.page);
        }
      } catch {
        /* localStorage недоступен — остаёмся на значениях по умолчанию */
      }
    })();
  }, []);

  // Загрузка реестра: все публичные проекты, фильтрация — клиентская.
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/v1/projects/registry`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: RegistryProject[] = await res.json();
        if (cancelled) return;
        setProjects(data);
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
  }, [session?.user?.accessToken]);

  // Write-through: URL + localStorage (после первого рендера).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (tab !== "projects") params.set("tab", tab);
    if (view !== "cards") params.set("view", view);
    const q = query.trim();
    if (q) params.set("q", q);
    if (category !== "all") params.set("category", category);
    if (ugtMin !== "all") params.set("ugt_min", ugtMin);
    if (ugtMax !== "all") params.set("ugt_max", ugtMax);
    if (sort !== "level_desc") params.set("sort", sort);
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
        JSON.stringify({ tab, query, category, ugtMin, ugtMax, sort, page } satisfies SavedFilters),
      );
    } catch {
      /* ignore */
    }
  }, [tab, view, query, category, ugtMin, ugtMax, sort, page]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const p of projects) if (p.category) seen.add(p.category);
    return [...seen].sort((a, b) => a.localeCompare(b, "ru"));
  }, [projects]);

  // Технологии УГТ 7+ — клиентский срез реестра (как и раньше, но без
  // выдуманного status: API registry не возвращает статус).
  const baseList = useMemo(() => {
    const min = tab === "technologies" ? Number(ugtMin === "all" ? 7 : ugtMin) : Number(ugtMin);
    const max = ugtMax === "all" ? 9 : Number(ugtMax);
    return projects.filter(
      (p) => (Number.isNaN(min) || p.current_level >= min) && (Number.isNaN(max) || p.current_level <= max),
    );
  }, [projects, tab, ugtMin, ugtMax]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = baseList;
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q) ||
          (p.organization ?? "").toLowerCase().includes(q),
      );
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    const sorted = [...list];
    switch (sort) {
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name, "ru"));
        break;
      case "level_asc":
        sorted.sort((a, b) => a.current_level - b.current_level);
        break;
      case "budget_desc":
        sorted.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0));
        break;
      case "budget_asc":
        sorted.sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0));
        break;
      case "date_desc":
        sorted.sort((a, b) => (b.published_at ?? b.created_at ?? "").localeCompare(a.published_at ?? a.created_at ?? ""));
        break;
      case "org_asc":
        sorted.sort((a, b) => (a.organization ?? "").localeCompare(b.organization ?? "", "ru"));
        break;
      default:
        sorted.sort((a, b) => b.current_level - a.current_level);
    }
    return sorted;
  }, [baseList, query, category, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasActiveFilters =
    query.trim() !== "" || category !== "all" || ugtMin !== "all" || ugtMax !== "all";

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setUgtMin(tab === "technologies" ? "7" : "all");
    setUgtMax("all");
    setSort("level_desc");
    setPage(1);
  };

  const switchTab = (next: RegistryTab) => {
    setTab(next);
    setCategory("all");
    setUgtMin(next === "technologies" ? "7" : "all");
    setUgtMax("all");
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
    <div data-od-id="registries" className="space-y-6">
      {/* Заголовок */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Реестры платформы</p>
        <h1 className="tz-page-title mt-2">Реестры проектов и технологий</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Общая витрина публичных проектов и реестр технологий с уровнем УГТ 7+ —
          по ГОСТ Р 58048-2017. Фильтры: категория, диапазон УГТ.
        </p>
      </div>

      {/* Переключатель реестров */}
      <div className="tz-tabs" role="tablist" aria-label="Реестры">
        <button
          role="tab"
          aria-selected={tab === "projects"}
          onClick={() => switchTab("projects")}
          className={`tz-tab ${tab === "projects" ? "tz-tab-active" : ""}`}
        >
          Проекты
          <span className="tz-tab-count">{loading ? "…" : baseList.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "technologies"}
          onClick={() => switchTab("technologies")}
          className={`tz-tab ${tab === "technologies" ? "tz-tab-active" : ""}`}
        >
          Технологии УГТ 7+
          <span className="tz-tab-count">
            {loading
              ? "…"
              : projects.filter((p) => p.current_level >= 7).length}
          </span>
        </button>
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Поиск по названию</span>
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
            placeholder="Поиск по названию…"
            className="tz-input pl-9"
          />
        </label>

        <label className={filterWrapClass}>
          <SlidersHorizontal size={15} className="shrink-0 text-tz-muted" aria-hidden />
          <span className="hidden text-tz-secondary sm:inline">Категория</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по категории"
          >
            <option value="all">Все</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className={filterWrapClass}>
          <span className="hidden text-tz-secondary sm:inline">УГТ от</span>
          <select
            value={ugtMin}
            onChange={(e) => {
              setUgtMin(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по минимальному уровню УГТ"
          >
            <option value="all">Любой</option>
            {UGT_LEVELS.map((level) => (
              <option key={level} value={String(level)}>
                УГТ {level}
              </option>
            ))}
          </select>
        </label>

        <label className={filterWrapClass}>
          <span className="hidden text-tz-secondary sm:inline">до</span>
          <select
            value={ugtMax}
            onChange={(e) => {
              setUgtMax(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по максимальному уровню УГТ"
          >
            <option value="all">УГТ 9</option>
            {UGT_LEVELS.map((level) => (
              <option key={level} value={String(level)}>
                УГТ {level}
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
          Найдено: <span className="font-semibold text-tz-fg">{filtered.length}</span>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-[14px] border border-tz-border bg-tz-surface"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[14px] border border-tz-danger bg-tz-surface p-8 text-center">
          <h2 className="tz-section-title">Не удалось загрузить реестр</h2>
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
          <h2 className="tz-section-title">
            {tab === "projects" ? "Проектов не найдено" : "Технологий УГТ 7+ пока нет"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
            Измените поиск или сбросьте фильтры.
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
          aria-label="Таблица реестра — листается горизонтально"
        >
          <table className="tz-table w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-tz-border">
                <th scope="col" className="px-4 py-3">Название</th>
                <th scope="col" className="px-4 py-3">Категория</th>
                <th scope="col" className="px-4 py-3">УГТ</th>
                <th scope="col" className="px-4 py-3">Бюджет</th>
                <th scope="col" className="px-4 py-3">Организация</th>
                <th scope="col" className="px-4 py-3">Опубликован</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/project/${p.id}`} className="block max-w-[300px]">
                      <span className="block truncate font-semibold text-tz-fg transition hover:text-tz-accent">
                        {p.name}
                      </span>
                      <span className="block font-mono text-[11px] text-tz-muted">
                        ЦНТР-{p.id}
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-tz-secondary">
                    {p.category ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={ugtClass(p.current_level)}>УГТ {p.current_level}</span>
                    <span className="mx-1 text-tz-muted" aria-hidden>→</span>
                    <span className="font-mono text-xs font-bold text-tz-muted">{p.target_level}</span>
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">{formatBudget(p.budget)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-tz-secondary">
                    {p.organization ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">
                    {formatDate(p.published_at ?? p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Компактные карточки БЕЗ радара: название, категория, УГТ, бюджет, организация */
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((p) => (
            <li key={p.id} className="min-w-0">
              <Link
                href={`/dashboard/project/${p.id}`}
                className="group flex h-full flex-col gap-3 rounded-[14px] border border-tz-border bg-tz-surface p-5 transition hover:border-tz-accent hover:shadow-[var(--tz-shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-tz-muted">
                      ЦНТР-{p.id}
                    </p>
                    <h3
                      className="mt-1 truncate font-semibold text-tz-fg transition group-hover:text-tz-accent"
                      title={p.name}
                    >
                      {p.name}
                    </h3>
                  </div>
                  {p.category && <span className="tz-badge tz-badge-neutral shrink-0">{p.category}</span>}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-tz-border pt-3">
                  <span className={ugtClass(p.current_level)}>
                    УГТ {p.current_level}
                    <span className="mx-1 text-tz-muted" aria-hidden>→</span>
                    {p.target_level}
                  </span>
                  <span className="truncate text-xs text-tz-muted" title={p.organization ?? ""}>
                    {p.organization ?? formatBudget(p.budget)}
                  </span>
                </div>
              </Link>
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
