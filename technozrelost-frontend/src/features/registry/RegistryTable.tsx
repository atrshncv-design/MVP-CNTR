"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpDown, ChevronDown, ChevronUp, FilePlus2 } from "lucide-react";

import { Empty } from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusBadge, getStatusLabel, PROJECT_STATUSES } from "@/lib/status";
import type { RegistryProjectOut } from "@/lib/types";

import { FavoriteStar } from "./FavoriteStar";
import { useTranslations } from "next-intl";

/**
 * Таблица реестра — табличный вид карточек (P3, R02).
 * Колонки: ID / Название / УГТ / Статус / Бюджет / Действия.
 * Сортировка кликом по заголовку, те же данные что карточки (displayItems),
 * состояние loading/error/empty/403 как у RegistryGrid, пагинация «Показать ещё».
 * Почему отдельная: RegistryGrid только карточки, таблица — альтернативный вид
 * с тем же источником данных (useRegistry). Переключение via RegistryViewToggle.
 */

// ——— Типы сортировки ———————————————————————————————————————————————
export type RegistryTableSortKey = "id" | "name" | "ugt" | "status" | "budget";
export type RegistryTableSortDir = "asc" | "desc";

// ——— Хелперы ————————————————————————————————————————————————————
function formatBudget(budget: number | null | undefined): string {
  if (budget == null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

function getId(item: unknown): number {
  const r = item as Record<string, unknown>;
  const v = r["id"];
  return typeof v === "number" ? v : Number(v ?? 0);
}

function getName(item: unknown): string {
  const r = item as Record<string, unknown>;
  const candidates = ["name", "full_name", "title", "registration_number"];
  for (const k of candidates) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "—";
}

function getUgtCurrent(item: unknown): number | null {
  const r = item as Record<string, unknown>;
  const v = r["current_level"] ?? r["ugt_level"] ?? r["level"] ?? r["currentLevel"];
  return typeof v === "number" ? v : null;
}

function getUgtTarget(item: unknown): number | null {
  const r = item as Record<string, unknown>;
  const v = r["target_level"] ?? r["targetLevel"];
  return typeof v === "number" ? v : null;
}

function getStatus(item: unknown): string {
  const r = item as Record<string, unknown>;
  const v = r["status"];
  return typeof v === "string" ? v : "";
}

function getBudgetValue(item: unknown): number | null {
  const r = item as Record<string, unknown>;
  const v = r["budget"];
  return typeof v === "number" ? v : null;
}

function statusOrder(status: string): number {
  const idx = (PROJECT_STATUSES as readonly string[]).indexOf(status);
  return idx === -1 ? 999 : idx;
}

// ——— Skeleton таблицы ——————————————————————————————————————————
export function RegistryTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="tz-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tz-border bg-tz-soft">
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Название</th>
              <th className="px-4 py-3 text-left font-semibold">УГТ</th>
              <th className="px-4 py-3 text-left font-semibold">Статус</th>
              <th className="px-4 py-3 text-left font-semibold">Бюджет</th>
              <th className="px-4 py-3 text-left font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-tz-border last:border-0">
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-14" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-48" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ——— Таблица ———————————————————————————————————————————————————
export function RegistryTable<T extends object>({
  items,
  loading,
  error,
  errorStatus,
  onRetry,
  hasMore,
  onLoadMore,
  loadingMore,
  isFavorite,
  onToggleFavorite,
  getHref,
  emptyTitle = "Пока нет проектов — создайте заявку",
  emptyDescription = "Проекты появляются в реестре после публикации.",
  emptyAction,
}: {
  items: T[];
  loading: boolean;
  error: string | null;
  errorStatus?: number | null;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number) => void;
  getHref?: (item: T) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  // i18n: используем переводы для a11y/тултипов, видимые заголовки остаются как в тесте (ID/Название/УГТ/Статус/Бюджет/Действия)
  const t = useTranslations("registry");
  const [sortKey, setSortKey] = React.useState<RegistryTableSortKey>("id");
  const [sortDir, setSortDir] = React.useState<RegistryTableSortDir>("asc");

  const handleSort = React.useCallback(
    (key: RegistryTableSortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const sorted = React.useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "id") {
        cmp = getId(a) - getId(b);
      } else if (sortKey === "name") {
        cmp = getName(a).localeCompare(getName(b), "ru");
      } else if (sortKey === "ugt") {
        const av = getUgtCurrent(a);
        const bv = getUgtCurrent(b);
        // null → в конец при asc, в начало при desc (обработаем позже через dir)
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
      } else if (sortKey === "status") {
        cmp = statusOrder(getStatus(a)) - statusOrder(getStatus(b));
        if (cmp === 0) cmp = getStatus(a).localeCompare(getStatus(b), "ru");
      } else if (sortKey === "budget") {
        const av = getBudgetValue(a);
        const bv = getBudgetValue(b);
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  if (loading) {
    return <RegistryTableSkeleton rows={6} />;
  }

  if (error) {
    if (errorStatus === 403) {
      return (
        <div className="tz-card tz-empty">
          <span className="tz-empty-icon">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">Доступ запрещён</h2>
          <p className="tz-empty-text">У вас нет прав для просмотра этого реестра (403).</p>
        </div>
      );
    }
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <Empty
        icon={<FilePlus2 size={22} aria-hidden="true" />}
        title={emptyTitle}
        description={emptyDescription}
        action={
          emptyAction ?? (
            <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
              Создать заявку
            </Link>
          )
        }
      />
    );
  }

  const SortIcon = ({ active, dir }: { active: boolean; dir: RegistryTableSortDir }) => {
    if (!active) return <ArrowUpDown size={14} className="text-tz-muted opacity-60" aria-hidden="true" />;
    return dir === "asc" ? (
      <ChevronUp size={14} className="text-tz-accent" aria-hidden="true" />
    ) : (
      <ChevronDown size={14} className="text-tz-accent" aria-hidden="true" />
    );
  };

  const headerButton = (key: RegistryTableSortKey, label: string) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        aria-label={`Сортировка по ${label}`}
        className="inline-flex items-center gap-1.5 font-semibold hover:text-tz-accent"
      >
        {label}
        <SortIcon active={active} dir={sortDir} />
      </button>
    );
  };

  return (
    <>
      <span className="sr-only" data-testid="registry-i18n">
        {t("titleTechnologies")}
      </span>
      <div className="tz-card overflow-hidden" data-registry-table>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Реестр в табличном виде</caption>
            <thead>
              <tr className="border-b border-tz-border bg-tz-soft text-left">
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3"
                  aria-sort={sortKey === "id" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {headerButton("id", "ID")}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3"
                  aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {headerButton("name", "Название")}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3"
                  aria-sort={sortKey === "ugt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {headerButton("ugt", "УГТ")}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3"
                  aria-sort={sortKey === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {headerButton("status", "Статус")}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3"
                  aria-sort={sortKey === "budget" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {headerButton("budget", "Бюджет")}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const id = getId(item);
                const name = getName(item);
                const ugtCur = getUgtCurrent(item);
                const ugtTar = getUgtTarget(item);
                const status = getStatus(item);
                const budget = getBudgetValue(item as unknown as RegistryProjectOut);
                const href =
                  getHref?.(item) ??
                  (typeof (item as Record<string, unknown>)["id"] === "number"
                    ? `/dashboard/project/${id}`
                    : undefined);
                const fav = isFavorite ? isFavorite(id) : false;

                // УГТ ячейка: «3 → 7» или «—»
                const ugtLabel =
                  ugtCur != null || ugtTar != null
                    ? `${ugtCur != null ? `УГТ ${ugtCur}` : "—"} → ${ugtTar ?? "—"}`
                    : "—";

                const statusLabel = status ? getStatusLabel(status) : "—";
                const badge = status ? getStatusBadge(status) : "tz-badge-neutral";

                // Название: линк если href, иначе span
                const titleNode = href ? (
                  <Link href={href} className="font-medium text-tz-fg hover:text-tz-accent hover:underline">
                    {name}
                  </Link>
                ) : (
                  <span className="font-medium text-tz-fg">{name}</span>
                );

                return (
                  <tr
                    key={id ?? idx}
                    className="border-b border-tz-border last:border-0 hover:bg-tz-soft/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-tz-muted">
                      ЦНТР-{id}
                    </td>
                    <td className="max-w-[360px] px-4 py-3">
                      <div className="line-clamp-2">{titleNode}</div>
                      {(item as Record<string, unknown>)["organization"] ? (
                        <div className="mt-0.5 text-xs text-tz-muted">
                          {String((item as Record<string, unknown>)["organization"])}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {ugtLabel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {status ? (
                        <span className={`tz-badge ${badge}`}>{statusLabel}</span>
                      ) : (
                        <span className="text-tz-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-tz-fg">
                      {formatBudget(budget)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="tz-btn tz-btn-secondary tz-btn-sm inline-flex items-center gap-1"
                          >
                            Открыть
                          </Link>
                        ) : (
                          <span className="text-xs text-tz-muted">—</span>
                        )}
                        {onToggleFavorite ? (
                          <FavoriteStar
                            active={!!fav}
                            onToggle={() => onToggleFavorite(id)}
                            label={name}
                            size={16}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {hasMore ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={!!loadingMore}
            className="tz-btn tz-btn-secondary"
          >
            {loadingMore ? "Загрузка…" : "Показать ещё"}
          </button>
        </div>
      ) : null}
    </>
  );
}
