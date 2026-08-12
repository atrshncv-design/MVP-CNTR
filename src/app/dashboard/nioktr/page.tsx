"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { NioktrCard } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type ViewMode = "cards" | "table";

const VIEW_KEY = "tz-nioktr-view";
const FILTERS_KEY = "tz-nioktr-filters";
const PAGE_SIZE = 20;
/** Максимум записей за запрос (ограничение API le=200). */
const FETCH_LIMIT = 200;
const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "reg_asc", label: "Рег. номер (А–Я)" },
  { value: "name_asc", label: "Название (А–Я)" },
  { value: "name_desc", label: "Название (Я–А)" },
  { value: "start_asc", label: "Сроки: сначала ранние" },
  { value: "customer_asc", label: "Заказчик (А–Я)" },
  { value: "executor_asc", label: "Исполнитель (А–Я)" },
];

interface SavedFilters {
  query: string;
  aiOnly: boolean;
  type: string;
  customer: string;
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

/** Русская плюрализация: 1 карточка, 2 карточки, 5 карточек. */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

const formatDate = (value: string | null): string => value ?? "—";

/**
 * Реестр НИОКТР (тикет 05 internal-ux-redesign): переключатель
 * «карточки/таблица», поиск, фильтры (ИИ-направление, тип, заказчик —
 * серверные параметры API /api/v1/nioktr), сортировка и пагинация
 * (клиентские, в пределах окна FETCH_LIMIT). Состояние — в URL
 * (?view&q&ai&type&customer&sort&page) и localStorage
 * (tz-nioktr-view / tz-nioktr-filters); URL приоритетнее.
 * Честный лимит: при ровно FETCH_LIMIT записях показывается примечание —
 * реестр большой, уточните поиск или фильтры. Карточки компактные,
 * без радара; подробности — на /dashboard/nioktr/[registration_number].
 */
export default function NioktrPage() {
  const { data: session } = useSession();

  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sort, setSort] = useState("reg_asc");
  const [page, setPage] = useState(1);

  const [cards, setCards] = useState<NioktrCard[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
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
        if (params.get("ai") === "1") setAiOnly(true);
        const t = params.get("type");
        if (t != null) setTypeFilter(t);
        const c = params.get("customer");
        if (c != null) setCustomerFilter(c);
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
          if (typeof saved.aiOnly === "boolean") setAiOnly(saved.aiOnly);
          if (typeof saved.type === "string") setTypeFilter(saved.type);
          if (typeof saved.customer === "string") setCustomerFilter(saved.customer);
          if (typeof saved.sort === "string") setSort(saved.sort);
          if (typeof saved.page === "number" && saved.page > 1) setPage(saved.page);
        }
      } catch {
        /* localStorage недоступен — остаёмся на значениях по умолчанию */
      }
    })();
  }, []);

  // Загрузка окна реестра: серверные фильтры (search/ai/type/customer),
  // limit=FETCH_LIMIT; сортировка и пагинация — клиентские. Поиск
  // дебаунсится, чтобы не дёргать API на каждую клавишу.
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams();
          params.set("limit", String(FETCH_LIMIT));
          if (query.trim()) params.set("search", query.trim());
          if (aiOnly) params.set("ai", "true");
          if (typeFilter !== "all") params.set("type", typeFilter);
          if (customerFilter !== "all") params.set("customer", customerFilter);
          const res = await fetch(`${API_URL}/api/v1/nioktr?${params}`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          });
          if (!res.ok) throw new Error(`API ${res.status}`);
          const data: NioktrCard[] = await res.json();
          if (cancelled) return;
          setCards(data);
          setTypes((prev) =>
            Array.from(new Set([...prev, ...data.flatMap((c) => c.nioktr_types)])).sort(),
          );
          setCustomers((prev) =>
            Array.from(
              new Set([
                ...prev,
                ...data.map((c) => c.customer_name).filter((x): x is string => !!x),
              ]),
            ).sort(),
          );
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      fetchData();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session?.user?.accessToken, query, aiOnly, typeFilter, customerFilter]);

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
    if (aiOnly) params.set("ai", "1");
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (customerFilter !== "all") params.set("customer", customerFilter);
    if (sort !== "reg_asc") params.set("sort", sort);
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
        JSON.stringify({ query, aiOnly, type: typeFilter, customer: customerFilter, sort, page } satisfies SavedFilters),
      );
    } catch {
      /* ignore */
    }
  }, [view, query, aiOnly, typeFilter, customerFilter, sort, page]);

  // Клиентская сортировка окна (API сортирует только по дате создания).
  const sorted = useMemo(() => {
    const list = [...cards];
    switch (sort) {
      case "name_asc":
        list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        break;
      case "name_desc":
        list.sort((a, b) => b.name.localeCompare(a.name, "ru"));
        break;
      case "start_asc":
        list.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
        break;
      case "customer_asc":
        list.sort((a, b) => (a.customer_name ?? "").localeCompare(b.customer_name ?? "", "ru"));
        break;
      case "executor_asc":
        list.sort((a, b) =>
          (a.executor_short_name ?? a.executor_name ?? "").localeCompare(
            b.executor_short_name ?? b.executor_name ?? "",
            "ru",
          ),
        );
        break;
      default:
        list.sort((a, b) => a.registration_number.localeCompare(b.registration_number));
    }
    return list;
  }, [cards, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const hasActiveFilters =
    query.trim() !== "" || aiOnly || typeFilter !== "all" || customerFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setAiOnly(false);
    setTypeFilter("all");
    setCustomerFilter("all");
    setSort("reg_asc");
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
          <p className="tz-eyebrow">Федеральный реестр</p>
          <h1 className="tz-page-title mt-2">Реестр НИОКТР</h1>
          <p className="mt-2 max-w-2xl text-tz-secondary">
            Научно-исследовательские и опытно-конструкторские работы — поиск по
            названию, фильтры по направлению и заказчику.
          </p>
        </div>
        <Link
          href="/dashboard/organizations"
          className="tz-btn tz-btn-secondary"
        >
          <Building2 size={16} aria-hidden />
          Каталог организаций
        </Link>
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Поиск по названию работы</span>
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
            placeholder="Поиск по названию работы…"
            className="tz-input pl-9"
          />
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-tz-border bg-tz-surface px-3 py-2 text-sm text-tz-fg">
          <input
            type="checkbox"
            checked={aiOnly}
            onChange={(e) => {
              setAiOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-tz-accent"
          />
          <Sparkles size={14} className="text-tz-accent" aria-hidden />
          Только ИИ
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
            aria-label="Фильтр по типу работ"
          >
            <option value="all">Любой</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className={filterWrapClass}>
          <span className="hidden text-tz-secondary sm:inline">Заказчик</span>
          <select
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setPage(1);
            }}
            className={`${filterSelectClass} max-w-[220px]`}
            aria-label="Фильтр по заказчику"
          >
            <option value="all">Любой</option>
            {customers.map((c) => (
              <option key={c} value={c} className="max-w-[220px]">
                {c}
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
          Найдено: <span className="font-semibold text-tz-fg">{sorted.length}</span>{" "}
          {pluralize(sorted.length, "карточка", "карточки", "карточек")}
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
              className="h-44 animate-pulse rounded-[14px] border border-tz-border bg-tz-surface"
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
      ) : sorted.length === 0 ? (
        <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center">
          <h2 className="tz-section-title">Карточек не найдено</h2>
          <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
            По заданным условиям работ нет. Измените поиск или сбросьте фильтры.
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
          aria-label="Таблица реестра НИОКТР — листается горизонтально"
        >
          <table className="tz-table w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-tz-border">
                <th scope="col" className="px-4 py-3">Рег. номер</th>
                <th scope="col" className="px-4 py-3">Название</th>
                <th scope="col" className="px-4 py-3">Тип</th>
                <th scope="col" className="px-4 py-3">Исполнитель</th>
                <th scope="col" className="px-4 py-3">Заказчик</th>
                <th scope="col" className="px-4 py-3">Начало</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((card) => (
                <tr key={card.registration_number}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/nioktr/${encodeURIComponent(card.registration_number)}`}
                      className="font-mono text-xs text-tz-accent transition hover:underline"
                    >
                      {card.registration_number}
                    </Link>
                    {card.is_ai_area && (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-tz-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-tz-accent">
                        <Sparkles size={10} aria-hidden /> ИИ
                      </span>
                    )}
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <Link
                      href={`/dashboard/nioktr/${encodeURIComponent(card.registration_number)}`}
                      className="block truncate font-semibold text-tz-fg transition hover:text-tz-accent"
                      title={card.name}
                    >
                      {card.name}
                    </Link>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-tz-secondary">
                    <span className="line-clamp-2">{card.nioktr_types[0] ?? "—"}</span>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-tz-secondary">
                    {card.executor_short_name ?? card.executor_name ?? "—"}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-tz-secondary">
                    {card.customer_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-tz-secondary">
                    {formatDate(card.start_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Компактные карточки БЕЗ радара: рег. номер, название, исполнитель,
           сроки, тип — и ссылка на подробную карточку */
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((card) => (
            <li key={card.registration_number} className="min-w-0">
              <Link
                href={`/dashboard/nioktr/${encodeURIComponent(card.registration_number)}`}
                className="group flex h-full flex-col gap-2.5 rounded-[14px] border border-tz-border bg-tz-surface p-5 transition hover:border-tz-accent hover:shadow-[var(--tz-shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-tz-muted">
                    {card.registration_number}
                  </span>
                  {card.is_ai_area && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-2 py-0.5 text-[10px] font-semibold text-tz-accent">
                      <Sparkles size={10} aria-hidden /> ИИ
                    </span>
                  )}
                </div>
                <h3
                  className="line-clamp-2 text-sm font-semibold leading-snug text-tz-fg transition group-hover:text-tz-accent"
                  title={card.name}
                >
                  {card.name}
                </h3>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-tz-border pt-2.5 text-[11px] text-tz-secondary">
                  {card.executor_short_name && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <Building2 size={12} className="shrink-0 text-tz-muted" aria-hidden />
                      <span className="truncate">{card.executor_short_name}</span>
                    </span>
                  )}
                  {card.start_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} className="text-tz-muted" aria-hidden />
                      {card.start_date}
                    </span>
                  )}
                  {card.nioktr_types[0] && (
                    <span className="rounded-md bg-tz-badge px-1.5 py-0.5">
                      {card.nioktr_types[0]}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Честный лимит окна: API отдаёт максимум FETCH_LIMIT записей */}
      {!loading && !error && sorted.length === FETCH_LIMIT && (
        <p className="rounded-[14px] border border-tz-border bg-tz-surface px-4 py-3 text-sm text-tz-secondary">
          Показаны первые {FETCH_LIMIT} записей реестра — уточните поиск или фильтры,
          чтобы увидеть больше.
        </p>
      )}

      {/* Пагинация */}
      {sorted.length > 0 && (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 border-t border-tz-border pt-4"
          aria-label="Пагинация"
        >
          <p className="text-sm text-tz-secondary">
            Показано{" "}
            <span className="font-semibold text-tz-fg">
              {(current - 1) * PAGE_SIZE + 1}–
              {Math.min(current * PAGE_SIZE, sorted.length)}
            </span>{" "}
            из {sorted.length}
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
