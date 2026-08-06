/**
 * T-010. Полная очередь операционных задач (/operations/queue).
 *
 * Плотная таблица 56–64px (объект / тип задачи / приоритет / статус /
 * ответственный / срок / недостающее / последнее событие / следующее
 * действие) + опциональный канбан-вид (не единственный). Фильтры по статусу
 * и поиск — URL-состояние (?status=&search=); счётчики только из Page.total.
 * Каждый элемент ведёт к объекту: технология → /operations/technology/[id],
 * запрос → /operations/requests/[id].
 */

import Link from "next/link";
import { Suspense } from "react";
import { ListOrdered, SearchX } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import type { QueueQuery } from "@/lib/adapter/types";
import type { OperationalTask, Status } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { formatDateTime } from "@/lib/datetime";
import { ResultCount } from "@/components/registry/result-count";
import { Pagination } from "@/components/registry/pagination";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import { EmptyState } from "@/components/states/empty-state";
import { QueueView } from "@/components/operations/queue-kanban";

export const dynamic = "force-dynamic";

const QUEUE_PAGE_SIZE = 50;

/** Статусы-фильтры очереди (открытые + ключевые финальные). */
const STATUS_FILTERS: readonly { value: Status | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "action_required", label: STATUS_LABELS.action_required },
  { value: "under_review", label: STATUS_LABELS.under_review },
  { value: "clarification", label: STATUS_LABELS.clarification },
  { value: "approval", label: STATUS_LABELS.approval },
  { value: "blocked", label: STATUS_LABELS.blocked },
  { value: "draft", label: STATUS_LABELS.draft },
  { value: "closed", label: STATUS_LABELS.closed },
];

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = (firstParam(sp.search) ?? "").trim();
  const rawStatus = firstParam(sp.status) ?? "";
  const status = STATUS_FILTERS.some((f) => f.value === rawStatus)
    ? (rawStatus as Status | "")
    : "";
  const page = Math.max(1, Math.floor(Number(firstParam(sp.page)) ?? 1) || 1);

  const query: QueueQuery = {
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize: QUEUE_PAGE_SIZE,
    sort: "priority",
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Очередь задач
        </h1>
        <p className="mt-1 max-w-2xl text-small leading-relaxed text-secondary">
          Все операционные задачи Центра по приоритету: проверка свидетельств,
          решения, уточнения и публикации. Каждая задача ведёт к объекту и
          следующему действию.
        </p>
      </header>

      {/* Поиск и фильтры по статусу (URL-состояние) */}
      <form
        action="/operations/queue"
        method="get"
        className="flex flex-wrap items-center gap-2"
        role="search"
      >
        <label className="sr-only" htmlFor="queue-search">
          Поиск по очереди
        </label>
        <input
          id="queue-search"
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Поиск: объект, событие, действие…"
          className="h-10 w-full max-w-xs rounded-control border border-subtle bg-surface px-3 text-small text-primary placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Найти
        </button>
      </form>

      <div
        role="group"
        aria-label="Фильтр по статусу"
        className="flex flex-wrap items-center gap-1.5"
      >
        {STATUS_FILTERS.map((filter) => {
          const href = filter.value
            ? `/operations/queue?status=${encodeURIComponent(filter.value)}${
                search ? `&search=${encodeURIComponent(search)}` : ""
              }`
            : `/operations/queue${search ? `?search=${encodeURIComponent(search)}` : ""}`;
          const active = status === filter.value;
          return (
            <Link
              key={filter.value || "all"}
              href={href}
              aria-current={active ? "true" : undefined}
              className={`inline-flex h-9 items-center rounded-control px-3 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                active
                  ? "bg-accent-strong text-accent-contrast"
                  : "border border-subtle bg-surface text-secondary hover:border-strong hover:text-primary"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <Suspense
        fallback={
          <LoadingSkeleton variant="table" rows={8} label="Загружаем очередь" />
        }
      >
        <QueueResults query={query} search={search} status={status} page={page} />
      </Suspense>
    </div>
  );
}

async function QueueResults({
  query,
  search,
  status,
  page,
}: {
  query: QueueQuery;
  search: string;
  status: Status | "";
  page: number;
}) {
  let items: OperationalTask[] = [];
  let total = 0;
  let totalPages = 1;
  let lastUpdated: string | null = null;
  let error = false;

  try {
    const result = await getAdapter().getOperationsQueue(query);
    items = result.items;
    total = result.total;
    totalPages = result.totalPages;
    lastUpdated = items.reduce(
      (max, task) => (task.updatedAt > max ? task.updatedAt : max),
      "",
    );
  } catch {
    error = true;
  }

  if (error) {
    return (
      <div className="rounded-panel border border-status-danger/40 bg-surface p-6">
        <p className="text-h3 font-semibold text-primary">
          Не удалось загрузить очередь
        </p>
        <p className="mt-2 text-small leading-relaxed text-secondary">
          Сервис данных временно недоступен. Повторите попытку позже.
        </p>
      </div>
    );
  }

  const hasQuery = Boolean(search || status);

  if (total === 0) {
    return (
      <div className="space-y-4">
        <ResultCount total={0} page={page} pageSize={QUEUE_PAGE_SIZE} />
        <EmptyState
          icon={hasQuery ? SearchX : ListOrdered}
          title={
            hasQuery ? "По заданным условиям задач нет" : "Очередь пуста"
          }
          description={
            hasQuery
              ? "Попробуйте изменить формулировку поиска или сбросить фильтр статуса."
              : `На ${formatDateTime(new Date().toISOString())} задач на проверку, решение и публикацию нет. Новые подачи появятся здесь автоматически.`
          }
          action={
            hasQuery ? (
              <Link
                href="/operations/queue"
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

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/operations/queue?${qs}` : "/operations/queue";
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ResultCount total={total} page={page} pageSize={QUEUE_PAGE_SIZE} />
        {lastUpdated ? (
          <p className="text-meta text-muted">
            последнее изменение: {formatDateTime(lastUpdated)}
          </p>
        ) : null}
      </div>

      <QueueView tasks={items} today={today} total={total} />

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={buildHref}
        ariaLabel="Страницы очереди"
      />
    </div>
  );
}
