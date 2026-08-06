/**
 * T-008. Список совпадений запроса (dossier requests/[id]).
 *
 * Каждое совпадение — TechnologyMatch из запроса + обогащённое досье
 * технологии (резолвится loader'ом через адаптер getTechnology, scope
 * participant). Технологии-фикстуры (isFixture) показываются с видимым
 * бейджем «Тестовый пример для проверки интерфейса».
 *
 * Пустое состояние — честное (STATES.md §3): «Совпадений пока нет» +
 * следующий шаг, а не фейковые совпадения.
 */

"use client";

import Link from "next/link";
import { FlaskConical, Percent, Rocket } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { EmptyState } from "@/components/states/empty-state";
import { FixtureBadge } from "./fixture-badge";
import { ShortlistButton } from "./shortlist-button";
import { isFixtureRecord, type TechnologyDossier, type TechnologyMatch } from "@/lib/types";

/** Совпадение + обогащённое досье технологии (null, если резолв не удался). */
export interface MatchedTechnologyView {
  match: TechnologyMatch;
  technology: TechnologyDossier | null;
}

export interface MatchListProps {
  matches: MatchedTechnologyView[];
  /** Заголовок честного пустого состояния. */
  emptyTitle?: string;
  /** Объяснение и следующий шаг при отсутствии совпадений. */
  emptyDescription?: string;
}

export function MatchList({
  matches,
  emptyTitle = "Совпадений пока нет",
  emptyDescription = "Центр подберёт проверенные технологии после проверки запроса. Уточните формулировку проблемы, чтобы повысить точность подбора.",
}: MatchListProps) {
  if (matches.length === 0) {
    return (
      <EmptyState
        compact
        title={emptyTitle}
        description={emptyDescription}
        icon={FlaskConical}
        action={
          <Link
            href="/app/customer/search"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Найти решения в реестре
          </Link>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {matches.map(({ match, technology }) => {
        const isFixture = technology ? isFixtureRecord(technology) : false;
        return (
          <li
            key={match.requestId}
            className="rounded-panel border border-subtle bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 text-body font-semibold tracking-tight text-primary">
                {match.title}
              </h3>
              {match.matchScore !== null ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-accent-soft px-2.5 py-1 text-small font-semibold text-accent">
                  <Percent className="h-3.5 w-3.5" aria-hidden />
                  {match.matchScore}% совпадения
                </span>
              ) : null}
            </div>

            {technology ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <UgtBadge level={technology.ugt.currentLevel} />
                <StatusBadge status={technology.visibility.publicationStatus} size="sm" />
                <span className="text-meta text-muted">
                  {technology.organization.name}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-meta text-muted">
                Досье технологии временно недоступно для просмотра.
              </p>
            )}

            {isFixture ? (
              <div className="mt-3">
                <FixtureBadge />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ShortlistButton
                technologyId={match.requestId}
                title={match.title}
                size="sm"
              />
              <Link
                href="/app/customer/pilots"
                className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-meta font-medium text-secondary transition-colors hover:bg-surface hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <Rocket className="h-3.5 w-3.5" aria-hidden />
                Как инициировать пилот
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
