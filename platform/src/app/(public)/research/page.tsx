/**
 * T-006. Реестр исследований и НИОКТР — РЕАЛЬНЫЕ данные (400 карточек).
 *
 * Search-first (Design.md §12.2): цель и свежесть данных, поиск и фильтры,
 * счётчик результатов (только из Page.total), карточки (mobile) / таблица
 * (desktop), пагинация, детальная карточка, provenance.
 *
 * URL-состояние (Design.md §11.4): ?search=&filters=&sort=&page= —
 * разбирается в RegistryQueryState, восстанавливается назад/вперёд.
 *
 * Ошибки: inline RegistryErrorState с retry (router.refresh, URL сохраняется);
 * dev-триггер ?simulate=error бросает AdapterError для проверки error-состояний.
 * Фикстур в публичном реестре нет (адаптер T-004: публичные методы — только
 * реальные записи).
 */

import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { getAdapter } from "@/lib/adapter/index.ts";
import { AdapterError } from "@/lib/adapter/errors.ts";
import type { ListQuery, Page } from "@/lib/adapter/types.ts";
import type { ResearchRecord } from "@/lib/types.ts";
import { formatDate } from "@/lib/datetime.ts";
import { SearchToolbar } from "@/components/registry/search-toolbar.tsx";
import { ResearchCard } from "@/components/registry/result-card.tsx";
import { ResearchTable } from "@/components/registry/result-table.tsx";
import { ResultCount } from "@/components/registry/result-count.tsx";
import { Pagination } from "@/components/registry/pagination.tsx";
import { RegistryErrorState } from "@/components/registry/registry-error.tsx";
import { EmptyState } from "@/components/states/empty-state.tsx";
import { LoadingSkeleton } from "@/components/states/loading-skeleton.tsx";
import {
  NIOKTR_TYPES,
  NIOKTR_YEARS,
  buildRegistryHref,
  hasActiveFilters,
  parseRegistryState,
  toListQuery,
  type RegistryQueryState,
} from "@/components/registry/query-state.ts";

export const metadata: Metadata = {
  title: "Реестр исследований и НИОКТР — ЦНТР Удмуртии",
  description:
    "Научно-исследовательские и опытно-конструкторские работы: 400 реальных карточек из открытого реестра Минобрнауки России, поиск, фильтры и пагинация.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const state = parseRegistryState(sp);

  /* Dev-триггер проверки error-состояния (только вне production). */
  if (sp.simulate === "error" && process.env.NODE_ENV !== "production") {
    throw new AdapterError(
      "Симулированный сбой реестра НИОКТР (dev-триггер: ?simulate=error)",
      { method: "listResearch" },
    );
  }

  const adapter = getAdapter();
  const summary = await adapter.getHomeSummary();

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-16">
      {/* Цель страницы и свежесть данных (§12.2) */}
      <header className="max-w-3xl">
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Реестр исследований и НИОКТР
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-secondary">
          Научно-исследовательские и опытно-конструкторские работы, выполненные
          организациями и предприятиями. Поиск по названию, ключевым словам,
          исполнителю или номеру регистрации.
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
          <span>
            Источник: <strong className="font-medium text-secondary">{summary.dataSource}</strong>
          </span>
          {summary.lastUpdatedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>обновлено {formatDate(summary.lastUpdatedAt)}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>{summary.researchCount} карточек</span>
        </p>
      </header>

      {/* Поиск, фильтры, сортировка */}
      <div className="mt-8">
        <SearchToolbar
          base="/research"
          state={state}
          yearOptions={NIOKTR_YEARS}
          typeOptions={NIOKTR_TYPES}
        />
      </div>

      {/* Результаты (реальные данные) */}
      <div className="mt-7">
        <Suspense
          fallback={
            <LoadingSkeleton
              variant="table"
              rows={8}
              label="Загружаем реестр НИОКТР"
            />
          }
        >
          <ResearchResults state={state} query={toListQuery(state)} />
        </Suspense>
      </div>
    </div>
  );
}

async function ResearchResults({
  state,
  query,
}: {
  state: RegistryQueryState;
  query: ListQuery;
}) {
  let page: Page<ResearchRecord>;
  try {
    page = await getAdapter().listResearch(query);
  } catch (error) {
    return (
      <RegistryErrorState
        title="Не удалось загрузить реестр"
        description={
          error instanceof Error
            ? error.message
            : "Данные временно недоступны. Попробуйте повторить позже."
        }
        fallbackHref="/research"
      />
    );
  }

  /* Пустой результат */
  if (page.items.length === 0) {
    /* Страница вне диапазона (например ?page=99) — записи есть, страницы нет */
    if (page.total > 0) {
      return (
        <div className="space-y-4">
          <ResultCount total={page.total} page={page.page} pageSize={page.pageSize} />
          <EmptyState
            icon={SearchX}
            title={`Страница ${page.page} вне диапазона`}
            description={`В реестре ${page.total} записей и ${page.totalPages} страниц. Вернитесь к первой странице.`}
            action={
              <Link
                href="/research"
                className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Первая страница
              </Link>
            }
          />
        </div>
      );
    }

    const hasQuery = state.search !== "" || hasActiveFilters(state);
    return (
      <div className="space-y-4">
        <ResultCount total={0} page={page.page} pageSize={page.pageSize} />
        <EmptyState
          icon={SearchX}
          title={
            hasQuery
              ? "По заданным условиям записи не найдены"
              : "В реестре пока нет записей"
          }
          description={
            hasQuery
              ? "Попробуйте изменить формулировку запроса или сбросить фильтры. В реестре только реальные карточки НИОКТР — выдуманных записей здесь нет."
              : "Реестр наполняется из открытых источников. Загляните позже."
          }
          action={
            hasQuery ? (
              <Link
                href="/research"
                className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Сбросить фильтры
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const buildPageHref = (p: number) =>
    buildRegistryHref("/research", { ...state, page: p });

  return (
    <div className="space-y-5">
      {/* Счётчик — только реальные данные (Page.total) */}
      <ResultCount total={page.total} page={page.page} pageSize={page.pageSize} />

      {/* Mobile: стек-карточки; Desktop: таблица (§8.3) */}
      <div className="grid gap-4 md:hidden">
        {page.items.map((record) => (
          <ResearchCard key={record.registrationNumber} record={record} />
        ))}
      </div>
      <div className="hidden md:block">
        <ResearchTable records={page.items} />
      </div>

      <Pagination
        page={page.page}
        totalPages={page.totalPages}
        buildHref={buildPageHref}
      />
    </div>
  );
}
