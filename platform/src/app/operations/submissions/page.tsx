/**
 * T-010. Подачи технологий и запросов (/operations/submissions).
 *
 * Записи, поданные на проверку (статус ≠ draft), из контролируемых
 * UI-фикстур кабинета Центра: технологии — technologySummaryFixtures,
 * запросы — customerRequestSummaryFixtures. Каждая подача ведёт к объекту
 * (досье/карточка модерации). Все записи явно помечены «демо».
 */

import Link from "next/link";
import { FileText, Inbox, Rocket } from "lucide-react";
import { formatDate } from "@/lib/datetime";
import {
  customerRequestSummaryFixtures,
  technologySummaryFixtures,
} from "@/data/fixtures";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { UgtBadge } from "@/components/ugt-badge";

const SUBMITTED_STATUSES = new Set([
  "under_review",
  "clarification",
  "approval",
  "approved",
  "rejected",
  "published",
  "blocked",
]);

export default function OperationsSubmissionsPage() {
  const technologies = technologySummaryFixtures.filter((t) =>
    SUBMITTED_STATUSES.has(t.verificationStatus),
  );
  const requests = customerRequestSummaryFixtures.filter((r) =>
    SUBMITTED_STATUSES.has(r.status),
  );
  const total = technologies.length + requests.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Подачи
        </h1>
        <p className="mt-1 max-w-2xl text-small leading-relaxed text-secondary">
          Технологии и запросы заказчиков, поданные на проверку Центра.
          Откройте подачу, чтобы проверить поля и вынести решение.
        </p>
        <p className="mt-2 text-meta text-muted">
          Подач на проверке: {total} · данные — фикстуры кабинета (демо)
        </p>
      </header>

      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Новых подач нет"
          description="Технологии и запросы, поданные на проверку, появятся здесь, когда участники отправят заявки."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section
            aria-labelledby="submissions-tech"
            className="rounded-panel border border-subtle bg-surface p-4 md:p-5"
          >
            <h2
              id="submissions-tech"
              className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
            >
              <Rocket className="h-5 w-5 text-accent" aria-hidden />
              Технологии
              <span className="rounded-[6px] bg-canvas px-2 py-0.5 font-mono text-meta text-secondary">
                {technologies.length}
              </span>
            </h2>
            {technologies.length === 0 ? (
              <p className="mt-3 rounded-control border border-dashed border-subtle px-3 py-5 text-center text-meta text-muted">
                Подач технологий пока нет
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {technologies.map((tech) => (
                  <li
                    key={tech.id}
                    className="rounded-control border border-subtle bg-canvas/60 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={tech.verificationStatus} size="sm" />
                      <UgtBadge level={tech.ugtLevel} />
                    </div>
                    <Link
                      href={`/operations/technology/${encodeURIComponent(tech.id)}`}
                      className="mt-2 block rounded-control font-medium text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      {tech.title}
                    </Link>
                    <p className="mt-1 text-meta text-muted">
                      {tech.organizationName} · обновлено{" "}
                      {formatDate(tech.lastUpdatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="submissions-requests"
            className="rounded-panel border border-subtle bg-surface p-4 md:p-5"
          >
            <h2
              id="submissions-requests"
              className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
            >
              <FileText className="h-5 w-5 text-accent" aria-hidden />
              Запросы заказчиков
              <span className="rounded-[6px] bg-canvas px-2 py-0.5 font-mono text-meta text-secondary">
                {requests.length}
              </span>
            </h2>
            {requests.length === 0 ? (
              <p className="mt-3 rounded-control border border-dashed border-subtle px-3 py-5 text-center text-meta text-muted">
                Подач запросов пока нет
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {requests.map((request) => (
                  <li
                    key={request.id}
                    className="rounded-control border border-subtle bg-canvas/60 p-3"
                  >
                    <StatusBadge status={request.status} size="sm" />
                    <Link
                      href={`/operations/requests/${encodeURIComponent(request.id)}`}
                      className="mt-2 block rounded-control font-medium text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      {request.title}
                    </Link>
                    <p className="mt-1 text-meta text-muted">
                      {request.customerOrganization} · подано{" "}
                      {formatDate(request.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
