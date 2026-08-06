/**
 * T-008. Шорт-листы кабинета заказчика (Design.md §13.2, шаг 5).
 *
 * Хранилище — localStorage (src/lib/customer-storage.ts, ключ nfr-shortlists).
 * P0: один список «Мой шорт-лист», структура хранилища готова к нескольким.
 *
 * Экспорты:
 * - ShortlistWorkspace — полная страница /customer/shortlists (карточки +
 *   удаление + сравнение через CompareView);
 * - ShortlistSummary — компактная секция дашборда (счётчик + первые позиции).
 *
 * Гидратация из localStorage — через useEffect с async IIFE (проходит
 * react-hooks/set-state-in-effect), чтобы не было hydration-mismatch.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FolderHeart, Search, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { EmptyState } from "@/components/states/empty-state";
import { FixtureBadge } from "./fixture-badge";
import { CompareView } from "./compare-view";
import { isFixtureRecord, type TechnologyDossier } from "@/lib/types";
import {
  DEFAULT_SHORTLIST_ID,
  clearDefaultShortlist,
  readShortlists,
  removeFromShortlist,
  type ShortlistStore,
} from "@/lib/customer-storage";

export interface ShortlistWorkspaceProps {
  /** Досье всех доступных технологий кабинета (для карточек и сравнения). */
  technologies: TechnologyDossier[];
}

export function ShortlistWorkspace({ technologies }: ShortlistWorkspaceProps) {
  const [store, setStore] = useState<ShortlistStore | null>(null);

  useEffect(() => {
    (async () => {
      setStore(readShortlists());
    })();
  }, []);

  const refresh = () => setStore(readShortlists());

  if (!store) {
    return (
      <div className="rounded-panel border border-subtle bg-surface p-6 text-small text-muted">
        Загружаем шорт-листы…
      </div>
    );
  }

  const list = store.lists.find((l) => l.id === DEFAULT_SHORTLIST_ID);
  const ids = list ? list.technologyIds : [];
  const items = ids
    .map((id) => technologies.find((t) => t.id === id))
    .filter((t): t is TechnologyDossier => Boolean(t));

  const remove = (id: string) => {
    removeFromShortlist(id);
    refresh();
  };

  const clearAll = () => {
    clearDefaultShortlist();
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-semibold tracking-tight text-primary">
          {list?.name ?? "Мой шорт-лист"}
          <span className="ml-2 text-meta font-normal text-muted">
            {items.length} {plural(items.length, "технология", "технологии", "технологий")}
          </span>
        </h2>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-status-danger transition-colors hover:bg-status-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Очистить шорт-лист
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="В шорт-листе пока пусто"
          description="Добавляйте проверенные технологии из совпадений запроса или результатов поиска, чтобы сравнить их и решить, по каким инициировать пилот."
          icon={FolderHeart}
          action={
            <Link
              href="/app/customer/search"
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <Search className="h-4 w-4" aria-hidden />
              Найти решения
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((tech) => (
            <li
              key={tech.id}
              className="flex flex-col rounded-panel border border-subtle bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-small font-semibold leading-snug text-primary">
                  {tech.title}
                </h3>
                <button
                  type="button"
                  onClick={() => remove(tech.id)}
                  aria-label={`Убрать из шорт-листа: ${tech.title}`}
                  className="shrink-0 rounded-control p-1.5 text-muted transition-colors hover:bg-status-danger-soft hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <UgtBadge level={tech.ugt.currentLevel} />
                <StatusBadge status={tech.visibility.publicationStatus} size="sm" />
              </div>
              <p className="mt-3 text-meta leading-relaxed text-secondary">
                {tech.organization.name}
                {tech.evidence.length > 0
                  ? ` · свидетельств: ${tech.evidence.length}`
                  : " · свидетельств нет"}
              </p>
              {isFixtureRecord(tech) ? (
                <div className="mt-3">
                  <FixtureBadge />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="compare-heading">
        <h3
          id="compare-heading"
          className="mb-3 text-h3 font-semibold tracking-tight text-primary"
        >
          Сравнение
        </h3>
        <CompareView technologies={items.length > 0 ? items : technologies} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Компактная секция для дашборда                                      */
/* ------------------------------------------------------------------ */

export interface ShortlistSummaryProps {
  technologies: TechnologyDossier[];
}

export function ShortlistSummary({ technologies }: ShortlistSummaryProps) {
  const [store, setStore] = useState<ShortlistStore | null>(null);

  useEffect(() => {
    (async () => {
      setStore(readShortlists());
    })();
  }, []);

  if (!store) {
    return (
      <div className="rounded-panel border border-subtle bg-surface p-5 text-small text-muted">
        Загружаем шорт-листы…
      </div>
    );
  }

  const list = store.lists.find((l) => l.id === DEFAULT_SHORTLIST_ID);
  const ids = list ? list.technologyIds : [];
  const items = ids
    .map((id) => technologies.find((t) => t.id === id))
    .filter((t): t is TechnologyDossier => Boolean(t));

  return (
    <div className="rounded-panel border border-subtle bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-small font-semibold text-primary">
          <FolderHeart className="h-4 w-4 text-accent" aria-hidden />
          Мой шорт-лист
        </h3>
        <Link
          href="/app/customer/shortlists"
          className="inline-flex h-9 items-center rounded-control px-3 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Открыть
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-small leading-relaxed text-secondary">
          Пока пусто. Добавьте технологии из совпадений запроса или поиска —
          сравните их и решите, по каким инициировать пилот.
        </p>
      ) : (
        <>
          <p className="mt-3 text-meta text-muted">
            {items.length} {plural(items.length, "технология", "технологии", "технологий")} в списке
          </p>
          <ul className="mt-3 space-y-2">
            {items.slice(0, 3).map((tech) => (
              <li key={tech.id} className="flex items-center gap-2 text-small text-secondary">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="min-w-0 truncate">{tech.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Склонение: plural(5, "технология", "технологии", "технологий"). */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
