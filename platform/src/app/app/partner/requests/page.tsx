/**
 * T-009. Запросы заказчиков для исполнителя (/app/partner/requests).
 *
 * Просмотр открытых запросов (фикстуры кабинета с бейджем) и подача заявки
 * (localStorage, PartnerApplicationRecord).
 */

import Link from "next/link";
import { ArrowRight, FileSearch } from "lucide-react";
import { customerRequestFixtures } from "@/data/fixtures";
import { PartnerNav } from "@/components/partner/partner-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ApplyButton } from "@/components/partner/apply-button";
import { isFixtureRecord } from "@/lib/types";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function PartnerRequestsPage() {
  const requests = customerRequestFixtures;

  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <header className="max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Запросы заказчиков
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Открытые потребности заказчиков, подходящие под ваши технологии.
          Подайте заявку — Центр проверит соответствие.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Открытых запросов пока нет"
            description="Новые запросы появляются после модерации Центром."
            icon={FileSearch}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="rounded-panel border border-subtle bg-surface p-5 transition-colors hover:border-strong"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={request.status} size="sm" />
                {isFixtureRecord(request) ? <FixtureBadge /> : null}
                <span className="text-meta text-muted">
                  {request.industry ?? "отрасль не указана"}
                </span>
              </div>
              <h2 className="mt-2 text-small font-semibold leading-snug text-primary">
                {request.title}
              </h2>
              <p className="mt-1.5 text-small leading-relaxed text-secondary">
                {request.problemStatement}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-meta text-muted">
                  {request.customerOrganization}
                </p>
                <div className="flex items-center gap-2">
                  <ApplyButton
                    targetType="request"
                    targetId={request.id}
                    targetTitle={request.title}
                    customerOrganization={request.customerOrganization}
                  />
                  <Link
                    href={`/requests/${request.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    Подробнее
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
