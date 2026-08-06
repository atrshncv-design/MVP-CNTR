/**
 * T-010. Модерация запроса (/operations/requests/[id]).
 * Полный запрос + решение по нему (DecisionForm: причина обязательна).
 */

import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, ListChecks } from "lucide-react";
import { customerRequestsById } from "@/data/fixtures";
import { StatusBadge } from "@/components/status-badge";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { DecisionForm } from "@/components/operations/decision-form";
import { EmptyState } from "@/components/states/empty-state";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function OperationsRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = customerRequestsById.get(id);

  if (!request) {
    return (
      <div className={CONTAINER}>
        <EmptyState
          title="Запрос не найден"
          description="Запись отсутствует в операционном контуре."
          action={
            <Link
              href="/operations/requests"
              className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              К запросам
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={CONTAINER}>
      <Link
        href="/operations/requests"
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        К запросам
      </Link>

      <header className="mt-4 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={request.status} />
          {isFixtureRecord(request) ? <FixtureBadge /> : null}
        </div>
        <h1 className="mt-3 text-h2 font-semibold tracking-tight text-primary">
          {request.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-secondary">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-muted" aria-hidden />
            {request.customerOrganization}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
            создан {formatDate(request.createdAt)}
          </span>
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section
            aria-labelledby="problem-heading"
            className="rounded-panel border border-subtle bg-surface p-6"
          >
            <h2
              id="problem-heading"
              className="text-h3 font-semibold tracking-tight text-primary"
            >
              Проблема
            </h2>
            <p className="mt-3 text-body leading-relaxed text-primary">
              {request.problemStatement}
            </p>

            {request.constraints.length > 0 ? (
              <div className="mt-5">
                <p className="text-meta font-medium text-muted">Ограничения</p>
                <ul className="mt-2 space-y-1.5">
                  {request.constraints.map((constraint) => (
                    <li
                      key={constraint}
                      className="flex items-start gap-2 text-small leading-relaxed text-secondary"
                    >
                      <ListChecks
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                        aria-hidden
                      />
                      {constraint}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 rounded-panel bg-canvas p-4">
              <p className="text-meta font-medium text-muted">Желаемый результат</p>
              <p className="mt-1.5 text-small leading-relaxed text-primary">
                {request.desiredCapability}
              </p>
            </div>

            {request.implementationContext ? (
              <div className="mt-5">
                <p className="text-meta font-medium text-muted">Контекст внедрения</p>
                <p className="mt-1.5 text-small leading-relaxed text-secondary">
                  {request.implementationContext}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-panel border border-subtle bg-surface p-5">
            <h2 className="text-small font-semibold text-primary">Решение</h2>
            <p className="mt-2 text-meta text-muted">
              Причина обязательна для отклонения и уточнения; одобрение и
              публикация требуют подтверждения. Демо-режим: решение
              сохраняется локально.
            </p>
            <div className="mt-4">
              <DecisionForm
                objectType="request"
                objectId={request.id}
                objectTitle={request.title}
                allowPublish={request.status === "approved"}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
