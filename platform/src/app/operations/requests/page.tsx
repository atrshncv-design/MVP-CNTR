/**
 * T-010. Модерация запросов заказчиков (/operations/requests).
 * Список запросов: статус, организация, отрасль, совпадения.
 */

import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { customerRequestFixtures } from "@/data/fixtures";
import { StatusBadge } from "@/components/status-badge";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8";

export default function OperationsRequestsPage() {
  const requests = customerRequestFixtures;

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Запросы заказчиков
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Модерация, подбор технологий и решения по запросам.
        </p>
      </header>

      {requests.length === 0 ? (
        <p className="mt-8 text-small text-secondary">
          Запросов пока нет — раздел готов к наполнению.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/operations/requests/${request.id}`}
                className="group block rounded-panel border border-subtle bg-surface p-5 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={request.status} size="sm" />
                  {isFixtureRecord(request) ? <FixtureBadge /> : null}
                  <span className="text-meta text-muted">
                    {request.industry ?? "отрасль не указана"}
                  </span>
                </div>
                <h2 className="mt-2 flex items-start gap-2 text-small font-semibold leading-snug text-primary group-hover:text-accent">
                  <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  {request.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
                  <span>{request.customerOrganization}</span>
                  <span>создан: {formatDate(request.createdAt)}</span>
                  {request.deadline ? (
                    <span>срок: {formatDate(request.deadline)}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
