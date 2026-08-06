/**
 * T-010. Управление НИОКТР (/operations/research).
 * РЕАЛЬНЫЕ данные: 400 карточек через адаптер, компактная таблица
 * с пагинацией (MAX_PAGE_SIZE=100).
 */

import Link from "next/link";
import { getAdapter } from "@/lib/adapter";
import { ErrorState } from "@/components/states/error-state";
import { ResultCount } from "@/components/registry/result-count";
import { Pagination } from "@/components/registry/pagination";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8";
const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

export default async function OperationsResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { page: pageParam, search } = await searchParams;
  const pageNum = Math.max(1, Number(pageParam) || 1);

  let page;
  try {
    page = await getAdapter().listResearch({
      search: search?.trim() || undefined,
      page: pageNum,
      pageSize: PAGE_SIZE,
    });
  } catch {
    return (
      <div className={CONTAINER}>
        <ErrorState
          title="Не удалось загрузить НИОКТР"
          description="Сервис данных временно недоступен. Повторите попытку позже."
        />
      </div>
    );
  }

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          НИОКТР
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Реальные записи реестра (источник: МИНОБРНАУКИ России) ·
          {page.total} карточек
        </p>
      </header>

      <form method="GET" action="/operations/research" className="mt-5 max-w-xl">
        <label htmlFor="ops-research-search" className="sr-only">
          Поиск по НИОКТР
        </label>
        <input
          id="ops-research-search"
          name="search"
          type="search"
          defaultValue={search ?? ""}
          placeholder="Поиск по названию, исполнителю, номеру…"
          className="w-full rounded-control border border-subtle bg-canvas px-4 py-2.5 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring"
        />
      </form>

      <div className="mt-4">
        <ResultCount total={page.total} page={page.page} pageSize={PAGE_SIZE} />
      </div>

      {page.items.length === 0 ? (
        <p className="mt-6 text-small text-secondary">
          По заданным условиям записи не найдены.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-panel border border-subtle bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-canvas/60">
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Рег. №</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Название</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Исполнитель</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Год</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-accent-soft/30"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-meta text-muted">
                    {record.registrationNumber}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/research/${record.id}`}
                      className="text-small font-medium leading-snug text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      {record.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-small text-secondary">
                    {record.organizationName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-meta text-secondary">
                    {record.createdDate ? formatDate(record.createdDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          buildHref={(p) =>
            `/operations/research?page=${p}${search ? `&search=${encodeURIComponent(search)}` : ""}`
          }
        />
      </div>
    </div>
  );
}
