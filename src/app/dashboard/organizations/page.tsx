"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import type { OrganizationSummary } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type ViewMode = "cards" | "table";

const VIEW_KEY = "tz-organizations-view";
const FILTERS_KEY = "tz-organizations-filters";
const PAGE_SIZE = 20;
/** Максимум записей за запрос (ограничение API le=200). */
const FETCH_LIMIT = 200;

const TYPE_LABELS: Record<string, string> = {
  scientific_org: "Научная организация",
  company: "Компания",
};

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "name_asc", label: "Название (А–Я)" },
  { value: "name_desc", label: "Название (Я–А)" },
  { value: "projects_desc", label: "Работ: больше" },
  { value: "projects_asc", label: "Работ: меньше" },
  { value: "region_asc", label: "Регион (А–Я)" },
];

interface SavedFilters {
  query: string;
  type: string;
  region: string;
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

/** Русская плюрализация: 1 работа, 2 работы, 5 работ. */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

/**
 * Каталог организаций (тикет 05 internal-ux-redesign): переключатель
 * «карточки/таблица», поиск, фильтры (тип организации, регион),
 * сортировка, пагинация. Источник — /api/v1/nioktr/organizations
 * (окно FETCH_LIMIT; при ровно FETCH_LIMIT записях — честное примечание).
 * Состояние — в URL (?view&q&type&region&sort&page) и localStorage
 * (tz-organizations-view / tz-organizations-filters); URL приоритетнее.
 * Карточки компактные, без радара; подробности —
 * на /dashboard/organizations/[ogrn].
 */
export default function OrganizationsPage() {
  const { data: session } = useSession();

  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [sort, setSort] = useState("projects_desc");
  const [page, setPage] = useState(1);

  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
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
        if (params.get("view") === "table" || params.get("view") === "cards") {
          setView(params.get("view") as ViewMode);
        }
        const q = params.get("q");
        if (q != null) setQuery(q);
        const t = params.get("type");
        if (t != null) setTypeFilter(t);
        const r = params.get("region");
        if (r != null) setRegionFilter(r);
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
          if (typeof saved.query === "string") setQuery(saved.query);
          if (typeof saved.type === "string") setTypeFilter(saved.type);
          if (typeof saved.region === "string") setRegionFilter(saved.region);
          if (typeof saved.sort === "string") setSort(saved.sort);
          if (typeof saved.page === "number" && saved.page > 1) setPage(saved.page);
        }
      } catch {
        /* localStorage недоступен — остаёмся на значениях по умолчанию */
      }
    })();
  }, []);

  // Загрузка окна каталога (endpoint медленный — грузим один раз,
  // поиск/фильтры/сортировка/пагинация — клиентские).
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(FETCH_LIMIT));
        const res = await fetch(`${API_URL}/api/v1/nioktr/organizations?${params}`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: OrganizationSummary[] = await res.json();
        if (cancelled) return;
        setOrgs(data);
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
    if (view !== "cards") params.set("view", view);
    const q = query.trim();
    if (q) params.set("q", q);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (regionFilter !== "all") params.set("region", regionFilter);
    if (sort !== "projects_desc") params.set("sort", sort);
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
        JSON.stringify({ query, type: typeFilter, region: regionFilter, sort, page } satisfies SavedFilters),
      );
    } catch {
      /* ignore */
    }
  }, [view, query, typeFilter, regionFilter, sort, page]);

  // Опции фильтров — из реальных данных окна.
  const { types, regions } = useMemo(() => {
    const typeSet = new Set<string>();
    const regionSet = new Set<string>();
    for (const o of orgs) {
      if (o.org_type) typeSet.add(o.org_type);
      if (o.region) regionSet.add(o.region);
    }
    return {
      types: [...typeSet].sort((a, b) => a.localeCompare(b, "ru")),
      regions: [...regionSet].sort((a, b) => a.localeCompare(b, "ru")),
    };
  }, [orgs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = orgs;
    if (q) {
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.short_name ?? "").toLowerCase().includes(q) ||
          (o.ogrn ?? "").toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") list = list.filter((o) => o.org_type === typeFilter);
    if (regionFilter !== "all") list = list.filter((o) => o.region === regionFilter);
    const sorted = [...list];
    switch (sort) {
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name, "ru"));
        break;
      case "projects_asc":
        sorted.sort((a, b) => a.projects_count - b.projects_count);
        break;
      case "region_asc":
        sorted.sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "", "ru"));
        break;
      default:
        sorted.sort((a, b) => b.projects_count - a.projects_count);
    }
    return sorted;
  }, [orgs, query, typeFilter, regionFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasActiveFilters =
    query.trim() !== "" || typeFilter !== "all" || regionFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setRegionFilter("all");
    setSort("projects_desc");
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
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-tz-border pb-6">
        <div>
          <p className="tz-eyebrow">Каталог</p>
          <h1 className="tz-page-title mt-2">Каталог организаций</h1>
          <p className="mt-2 max-w-2xl text-tz-secondary">
            Исполнители научно-исследовательских работ из карточек НИОКТР —
            поиск, фильтры по типу и региону.
          </p>
        </div>
        <Link
          href="/dashboard/nioktr"
          className="tz-btn tz-btn-secondary"
        >
          Реестр НИОКТР
        </Link>
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Поиск по названию организации</span>
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
            placeholder="Поиск по названию организации…"
            className="tz-input pl-9"
          />
        </label>

        <label className={filterWrapClass}>
          <SlidersHorizontal size={15} className="shrink-0 text-tz-muted" aria-hidden />
          <span className="hidden text-tz-secondary sm:inline">Тип</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className={filterSelectClass}
            aria-label="Фильтр по типу организации"
          >
            <option value="all">Все</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </label>

        <label className={filterWrapClass}>
          <span className="hidden text-tz-secondary sm:inline">Регион</span>
          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className={`${filterSelectClass} max-w-[220px]`}
            aria-label="Фильтр по региону"
          >
            <option value="all">Все</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
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
          {pluralize(filtered.length, "организация", "организации", "организаций")}
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
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[14px] border border-tz-border bg-tz-surface"
            />
          ))}
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
          <h2 className="tz-section-title">Организации не найдены</h2>
          <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
            По заданным условиям организаций нет. Измените поиск или сбросьте фильтры.
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
          aria-label="Таблица каталога организаций — листается горизонтально"
        >
          <table className="tz-table w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-tz-border">
                <th scope="col" className="px-4 py-3">Название</th>
                <th scope="col" className="px-4 py-3">Тип</th>
                <th scope="col" className="px-4 py-3">Регион</th>
                <th scope="col" className="px-4 py-3">Работ</th>
                <th scope="col" className="px-4 py-3">ОГРН</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((org) => (
                <tr key={org.id}>
                  <td className="max-w-[340px] px-4 py-3">
                    {org.ogrn ? (
                      <Link
                        href={`/dashboard/organizations/${encodeURIComponent(org.ogrn)}`}
                        className="block truncate font-semibold text-tz-fg transition hover:text-tz-accent"
                        title={org.name}
                      >
                        {org.name}
                      </Link>
                    ) : (
                      <span className="block truncate font-semibold text-tz-fg" title={org.name}>
                        {org.name}
                      </span>
                    )}
                    {org.short_name && org.short_name !== org.name && (
                      <span className="block truncate text-[11px] text-tz-muted">
                        {org.short_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">
                    {TYPE_LABELS[org.org_type ?? ""] ?? org.org_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">{org.region ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-tz-fg">
                      {org.projects_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-tz-muted">
                    {org.ogrn ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Компактные карточки БЕЗ радара: название, тип, регион, число работ */
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((org) => (
            <li key={org.id} className="min-w-0">
              <Link
                href={
                  org.ogrn
                    ? `/dashboard/organizations/${encodeURIComponent(org.ogrn)}`
                    : "#"
                }
                aria-disabled={!org.ogrn}
                className={`group flex h-full flex-col gap-2.5 rounded-[14px] border border-tz-border bg-tz-surface p-5 transition ${
                  org.ogrn
                    ? "hover:border-tz-accent hover:shadow-[var(--tz-shadow-card)]"
                    : "cursor-default"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tz-badge">
                    {org.org_type === "scientific_org" ? (
                      <GraduationCap size={16} className="text-tz-accent" aria-hidden />
                    ) : (
                      <Store size={16} className="text-tz-secondary" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3
                      className="line-clamp-2 text-sm font-semibold leading-snug text-tz-fg transition group-hover:text-tz-accent"
                      title={org.name}
                    >
                      {org.name}
                    </h3>
                    <p className="mt-1 text-[11px] text-tz-muted">
                      {TYPE_LABELS[org.org_type ?? ""] ?? org.org_type ?? "Организация"}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-tz-border pt-2.5 text-[11px] text-tz-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={12} className="text-tz-muted" aria-hidden />
                    {org.projects_count}{" "}
                    {pluralize(org.projects_count, "работа", "работы", "работ")}
                  </span>
                  {org.region && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} className="text-tz-muted" aria-hidden />
                      {org.region}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Честный лимит окна: API отдаёт максимум FETCH_LIMIT записей */}
      {!loading && !error && filtered.length === FETCH_LIMIT && (
        <p className="rounded-[14px] border border-tz-border bg-tz-surface px-4 py-3 text-sm text-tz-secondary">
          Показаны первые {FETCH_LIMIT} организаций каталога — уточните поиск или
          фильтры, чтобы увидеть больше.
        </p>
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
