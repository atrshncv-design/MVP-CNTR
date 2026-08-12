"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ProjectSummary } from "@/lib/api-client";

type ViewMode = "cards" | "table";

const VIEW_KEY = "tz-projects-view";
const FILTERS_KEY = "tz-projects-filters";
const PAGE_SIZE = 8;

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  auto_confirmed: "Подтверждён автоматически",
  active: "В работе",
  review: "На проверке",
  published: "Опубликован",
  completed: "Завершён",
  rejected: "Отклонён",
  archived: "В архиве",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "tz-badge-neutral",
  auto_confirmed: "tz-badge-success",
  active: "tz-badge-accent",
  review: "tz-badge-review",
  published: "tz-badge-accent",
  completed: "tz-badge-success",
  rejected: "tz-badge-danger",
  archived: "tz-badge-neutral",
};

const UGT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "updated_desc", label: "Сначала недавно обновлённые" },
  { value: "created_desc", label: "Сначала новые" },
  { value: "name_asc", label: "Название (А–Я)" },
  { value: "name_desc", label: "Название (Я–А)" },
  { value: "level_desc", label: "УГТ: выше уровень" },
  { value: "level_asc", label: "УГТ: ниже уровень" },
];

interface SavedFilters {
  query: string;
  status: string;
  ugt: string;
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

/**
 * Интерактивный список проектов (тикет 04 internal-ux-redesign):
 * переключатель «карточки/таблица», поиск, фильтры (статус, УГТ),
 * сортировка, пагинация. Состояние сохраняется в URL-параметрах
 * (?view&q&status&ugt&sort&page) и дублируется в localStorage
 * (tz-projects-view / tz-projects-filters); URL приоритетнее.
 *
 * Компонент обёрнут в <Suspense> на странице (паттерн useSearchParams),
 * поэтому useState-инициализаторы читают реальные параметры URL.
 */
export default function ProjectsExplorer({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>(() =>
    searchParams.get("view") === "table" ? "table" : "cards",
  );
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "all");
  const [ugt, setUgt] = useState(() => searchParams.get("ugt") ?? "all");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "updated_desc");
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get("page"));
    return Number.isInteger(p) && p > 1 ? p : 1;
  });

  const restored = useRef(false);
  const firstRender = useRef(true);

  // Восстановление сохранённых фильтров из localStorage, если в URL их нет
  // (URL приоритетнее). Гидрация — в эффекте (async-IIFE, react-hooks/set-state-in-effect).
  useEffect(() => {
    (async () => {
      if (restored.current) return;
      restored.current = true;
      const params = new URLSearchParams(searchParams.toString());
      if (params.size > 0) return;
      try {
        const savedView = window.localStorage.getItem(VIEW_KEY);
        if (savedView === "table" || savedView === "cards") setView(savedView);
        const saved = JSON.parse(
          window.localStorage.getItem(FILTERS_KEY) ?? "null",
        ) as Partial<SavedFilters> | null;
        if (saved && typeof saved === "object") {
          if (typeof saved.query === "string") setQuery(saved.query);
          if (typeof saved.status === "string") setStatus(saved.status);
          if (typeof saved.ugt === "string") setUgt(saved.ugt);
          if (typeof saved.sort === "string") setSort(saved.sort);
          if (typeof saved.page === "number" && saved.page > 1) setPage(saved.page);
        }
      } catch {
        /* localStorage недоступен (приватный режим и т.п.) — остаёмся на значениях по умолчанию */
      }
    })();
  }, [searchParams]);

  // Запись в URL и localStorage — после первого рендера (write-through).
  // router.replace / localStorage.setItem — не setState, эффект чистый.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (view !== "cards") params.set("view", view);
    const q = query.trim();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (ugt !== "all") params.set("ugt", ugt);
    if (sort !== "updated_desc") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `/dashboard/projects?${qs}` : "/dashboard/projects", {
      scroll: false,
    });
    try {
      window.localStorage.setItem(VIEW_KEY, view);
      window.localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ query, status, ugt, sort, page } satisfies SavedFilters),
      );
    } catch {
      /* ignore */
    }
  }, [view, query, status, ugt, sort, page, router]);

  const statuses = useMemo(() => {
    const seen = new Set<string>();
    for (const p of projects) if (p.status) seen.add(p.status);
    return [...seen];
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects;
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q),
      );
    }
    if (status !== "all") list = list.filter((p) => p.status === status);
    if (ugt !== "all") {
      const level = Number(ugt);
      list = list.filter((p) => p.current_level === level);
    }
    const sorted = [...list];
    switch (sort) {
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name, "ru"));
        break;
      case "level_desc":
        sorted.sort((a, b) => b.current_level - a.current_level);
        break;
      case "level_asc":
        sorted.sort((a, b) => a.current_level - b.current_level);
        break;
      case "created_desc":
        sorted.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        break;
      default:
        sorted.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return sorted;
  }, [projects, query, status, ugt, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasActiveFilters =
    query.trim() !== "" || status !== "all" || ugt !== "all" || sort !== "updated_desc";

  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setUgt("all");
    setSort("updated_desc");
    setPage(1);
  };

  const switchView = (next: ViewMode) => setView(next);
  const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;
  const ugtClass = (level: number) => `tz-ugt tz-ugt-${Math.min(9, Math.max(1, level))}`;

  const filterSelectClass =
    "bg-transparent text-tz-fg outline-none";
  const filterWrapClass =
    "flex items-center gap-2 rounded-lg border border-tz-border bg-tz-surface px-3 py-2.5 text-sm text-tz-secondary";
  const viewButtonClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-tz-accent-soft text-tz-accent"
        : "text-tz-secondary hover:bg-tz-surface-2 hover:text-tz-fg"
    }`;

  return (
    <div className="space-y-5">
      {/* Панель инструментов: поиск, фильтры, сортировка, вид */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Поиск по названию проекта</span>
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
          <span className="hidden text-tz-secondary sm:inline">Статус</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по статусу"
          >
            <option value="all">Все</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <label className={filterWrapClass}>
          <span className="hidden text-tz-secondary sm:inline">УГТ</span>
          <select
            value={ugt}
            onChange={(e) => {
              setUgt(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по уровню УГТ"
          >
            <option value="all">Все уровни</option>
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
          aria-label="Вид списка проектов"
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
          Найдено проектов:{" "}
          <span className="font-semibold text-tz-fg">{filtered.length}</span>
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

      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center">
          <h2 className="tz-section-title">
            {projects.length === 0 ? "Проектов пока нет" : "Ничего не найдено"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
            {projects.length === 0
              ? "В вашей области доступа ещё нет созданных проектов."
              : "По заданным условиям проектов нет. Измените поиск или сбросьте фильтры."}
          </p>
          {projects.length > 0 && (
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
        /* Таблица: горизонтальный скролл в контейнере с tabindex для клавиатуры.
           На мобильном можно переключиться на карточки кнопкой выше. */
        <div
          className="overflow-x-auto rounded-[14px] border border-tz-border bg-tz-surface"
          tabIndex={0}
          aria-label="Таблица проектов — листается горизонтально"
        >
          <table className="tz-table w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-tz-border">
                <th scope="col" className="px-4 py-3">
                  Название
                </th>
                <th scope="col" className="px-4 py-3">
                  Категория
                </th>
                <th scope="col" className="px-4 py-3">
                  УГТ
                </th>
                <th scope="col" className="px-4 py-3">
                  Статус
                </th>
                <th scope="col" className="px-4 py-3">
                  Обновлён
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/project/${project.id}`}
                      className="block max-w-[300px]"
                    >
                      <span className="block truncate font-semibold text-tz-fg transition hover:text-tz-accent">
                        {project.name}
                      </span>
                      <span className="block font-mono text-[11px] text-tz-muted">
                        ЦНТР-{project.id}
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-tz-secondary">
                    {project.category ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={ugtClass(project.current_level)}>
                      УГТ {project.current_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`tz-badge ${STATUS_BADGE[project.status] ?? "tz-badge-neutral"}`}
                    >
                      {statusLabel(project.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">
                    {formatDate(project.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Компактные карточки БЕЗ радаров: название, категория, УГТ-бейдж,
           статус, компактные метаданные. */
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((project) => (
            <li key={project.id} className="min-w-0">
              <Link
                href={`/dashboard/project/${project.id}`}
                className="group flex h-full flex-col gap-3 rounded-[14px] border border-tz-border bg-tz-surface p-5 transition hover:border-tz-accent hover:shadow-[var(--tz-shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-tz-muted">
                      ЦНТР-{project.id}
                    </p>
                    <h3
                      className="mt-1 truncate font-semibold text-tz-fg transition group-hover:text-tz-accent"
                      title={project.name}
                    >
                      {project.name}
                    </h3>
                  </div>
                  <span
                    className={`tz-badge shrink-0 ${STATUS_BADGE[project.status] ?? "tz-badge-neutral"}`}
                  >
                    {statusLabel(project.status)}
                  </span>
                </div>
                {project.category && (
                  <p className="truncate text-sm text-tz-secondary" title={project.category}>
                    {project.category}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-tz-border pt-3">
                  <span className={ugtClass(project.current_level)}>
                    УГТ {project.current_level}
                  </span>
                  <span className="text-xs text-tz-muted">
                    Обновлён: {formatDate(project.updated_at)}
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
