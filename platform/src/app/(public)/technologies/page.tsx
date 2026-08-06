/**
 * T-006. Реестр технологий (/technologies).
 *
 * Честное пустое состояние (DATA-CONTRACTS §2, ROUTES.md: «truthful empty
 * state»): в P0 реальных опубликованных технологий нет — это НОРМА, а не
 * ошибка. Реестр наполняется после проверки досье Центром. Запись читается
 * через адаптер (listTechnologies), фикстуры в публичный реестр не попадают.
 */

import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { getAdapter } from "@/lib/adapter/index.ts";
import type { TechnologySummary } from "@/lib/types.ts";
import { EmptyState } from "@/components/states/empty-state.tsx";
import { LoadingSkeleton } from "@/components/states/loading-skeleton.tsx";
import { RegistryErrorState } from "@/components/registry/registry-error.tsx";

export const metadata: Metadata = {
  title: "Реестр технологий — ЦНТР Удмуртии",
  description:
    "Проверенные Центром технологии с подтверждённым уровнем готовности УГТ.",
};

export default async function TechnologiesPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-16">
      <header className="max-w-3xl">
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Реестр технологий
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-secondary">
          Технологии, прошедшие проверку Центра, с подтверждённым уровнем
          готовности по ГОСТ Р 58048-2017. Публикация возможна после полного
          цикла верификации досье.
        </p>
      </header>

      <div className="mt-8">
        <Suspense
          fallback={
            <LoadingSkeleton variant="list" rows={3} label="Загружаем реестр технологий" />
          }
        >
          <TechnologiesSection />
        </Suspense>
      </div>
    </div>
  );
}

async function TechnologiesSection() {
  let items: TechnologySummary[];
  try {
    const page = await getAdapter().listTechnologies({ pageSize: 20 });
    items = page.items;
  } catch (error) {
    return (
      <RegistryErrorState
        title="Не удалось загрузить реестр технологий"
        description={
          error instanceof Error
            ? error.message
            : "Данные временно недоступны. Попробуйте повторить позже."
        }
        fallbackHref="/technologies"
      />
    );
  }

  /* Пустой реестр — норма; но если записи появятся, показываем их честно. */
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Пока нет опубликованных технологий по этому фильтру"
        description={
          <>
            В реестр попадают только верифицированные технологии: после
            проверки Центром досье, свидетельств и уровня готовности УГТ.
            Первые публикации появятся после старта приёмной кампании.
          </>
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Представить технологию
            </Link>
            <Link
              href="/research"
              className="inline-flex h-11 items-center rounded-control border border-strong px-5 text-small font-medium text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Смотреть исследования и НИОКТР
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-subtle border-y border-subtle">
      {items.map((technology) => (
        <li key={technology.id} className="py-5">
          <h2 className="text-h3 font-semibold tracking-tight text-primary">
            {technology.title}
          </h2>
          <p className="mt-1 text-small text-secondary">
            {technology.organizationName}
          </p>
        </li>
      ))}
    </ul>
  );
}
