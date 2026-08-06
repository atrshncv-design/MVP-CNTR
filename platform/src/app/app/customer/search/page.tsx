/**
 * T-008. Поиск решений в кабинете заказчика (/customer/search).
 *
 * Два источника, честно разделённые:
 * - реальный реестр НИОКТР через адаптер (с provenance-бейджем);
 * - технологии кабинета (фикстуры с видимым бейджем «Тестовый пример
 *   для проверки интерфейса») — до появления реальных технологий.
 */

import Link from "next/link";
import { ArrowRight, FlaskConical, Search } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { technologyDossierFixtures } from "@/data/fixtures";
import { isFixtureRecord, type ResearchRecord } from "@/lib/types";
import { CustomerNav } from "@/components/customer/customer-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { EmptyState } from "@/components/states/empty-state";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

const INPUT_CLASS =
  "w-full rounded-control border border-subtle bg-canvas px-4 py-3 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring";

export default async function CustomerSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let research: ResearchRecord[] = [];
  if (query) {
    try {
      const page = await getAdapter().listResearch({ search: query, pageSize: 20 });
      research = page.items;
    } catch {
      research = [];
    }
  }

  const norm = query.toLowerCase();
  const fixtures = technologyDossierFixtures.filter(
    (t) =>
      !query ||
      t.title.toLowerCase().includes(norm) ||
      t.shortDescription.toLowerCase().includes(norm),
  );

  const total = research.length + fixtures.length;

  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Поиск решений
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Проверенные технологии, исследования и исполнители под задачу
          организации. Фикстуры кабинета помечены как тестовые примеры.
        </p>
      </header>

      <form method="GET" action="/customer/search" className="mt-6 max-w-3xl">
        <label htmlFor="customer-search" className="sr-only">
          Поиск решений
        </label>
        <div className="flex gap-2">
          <input
            id="customer-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Например: автоматизация контроля качества, ИИ, композитные материалы…"
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <Search className="h-4 w-4" aria-hidden />
            Найти
          </button>
        </div>
      </form>

      {query ? (
        <p className="mt-4 text-meta text-muted" role="status">
          По запросу «{query}» найдено: {total}
        </p>
      ) : null}

      {query && total === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Ничего не найдено"
            description="Уточните формулировку или сбросьте запрос. Новые проверенные записи появляются после публикации Центром."
            icon={FlaskConical}
          />
        </div>
      ) : null}

      {research.length > 0 ? (
        <section aria-labelledby="research-heading" className="mt-8">
          <h2
            id="research-heading"
            className="text-h3 font-semibold tracking-tight text-primary"
          >
            Исследования и НИОКТР
          </h2>
          <p className="mt-1 text-meta text-muted">
            Реальные записи реестра · источник: МИНОБРНАУКИ России
          </p>
          <ul className="mt-4 space-y-3">
            {research.map((record) => (
              <li
                key={record.id}
                className="rounded-panel border border-subtle bg-surface p-5 transition-colors hover:border-strong"
              >
                <p className="font-mono text-meta text-muted">
                  {record.registrationNumber}
                </p>
                <h3 className="mt-1 text-small font-semibold leading-snug text-primary">
                  {record.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted">
                  <span>{record.organizationName}</span>
                  {record.createdDate ? (
                    <span>{formatDate(record.createdDate)}</span>
                  ) : null}
                  {record.isAiArea ? <span>ИИ-направление</span> : null}
                </div>
                {record.keywords.length > 0 ? (
                  <p className="mt-2 text-meta text-muted">
                    {record.keywords.slice(0, 4).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fixtures.length > 0 ? (
        <section aria-labelledby="tech-heading" className="mt-8">
          <h2
            id="tech-heading"
            className="text-h3 font-semibold tracking-tight text-primary"
          >
            Технологии кабинета
          </h2>
          <p className="mt-1 text-meta text-muted">
            Примеры для проверки интерфейса — реальные технологии появятся после
            подключения данных
          </p>
          <ul className="mt-4 space-y-3">
            {fixtures.map((tech) => (
              <li
                key={tech.id}
                className="rounded-panel border border-subtle bg-surface p-5 transition-colors hover:border-strong"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {isFixtureRecord(tech) ? <FixtureBadge /> : null}
                  <UgtBadge level={tech.ugt.currentLevel} />
                </div>
                <h3 className="mt-2 text-small font-semibold leading-snug text-primary">
                  {tech.title}
                </h3>
                <p className="mt-1.5 text-small leading-relaxed text-secondary">
                  {tech.shortDescription}
                </p>
                <p className="mt-2 text-meta text-muted">{tech.organization.name}</p>
                <Link
                  href={`/technology/${tech.id}`}
                  className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Открыть досье
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!query ? (
        <section aria-labelledby="prompt-heading" className="mt-8">
          <div className="rounded-panel border border-subtle bg-surface p-6">
            <h2
              id="prompt-heading"
              className="text-h3 font-semibold tracking-tight text-primary"
            >
              Что искать
            </h2>
            <p className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
              Опишите задачу словами: «неразрушающий контроль», «композитные
              материалы», «предиктивное обслуживание». Поиск охватывает названия,
              ключевые слова, исполнителей и аннотации реального реестра НИОКТР.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
