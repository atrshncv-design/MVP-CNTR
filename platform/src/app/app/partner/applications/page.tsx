/**
 * T-009. Заявки исполнителя (/app/partner/applications).
 *
 * Заявки на запросы заказчиков и пилоты: localStorage-записи (созданные в
 * этом кабинете) + фикстуры. Статусы по STATES.md.
 */

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { partnerApplicationFixtures } from "@/data/fixtures";
import { listPartnerApplications } from "@/lib/partner-storage";
import { PartnerNav } from "@/components/partner/partner-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function PartnerApplicationsPage() {
  const local = listPartnerApplications();
  const fixtures = partnerApplicationFixtures;
  const applications = [...fixtures, ...local];

  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Заявки
          </h1>
          <p className="mt-1.5 text-small text-secondary">
            Отклики на запросы заказчиков и пилоты от вашей организации
          </p>
        </div>
        <Link
          href="/app/partner/requests"
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Запросы заказчиков
        </Link>
      </header>

      {applications.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="У организации пока нет заявок"
            description="Подайте заявку на открытый запрос заказчика или пилот — Центр рассмотрит её в очереди."
            icon={FileText}
            action={
              <Link
                href="/app/partner/requests"
                className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Открытые запросы
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {applications.map((application) => (
            <li
              key={application.id}
              className="rounded-panel border border-subtle bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} size="sm" />
                {isFixtureRecord(application) ? <FixtureBadge /> : null}
                <span className="text-meta text-muted">
                  {application.targetType === "request"
                    ? "запрос заказчика"
                    : "пилот"}
                </span>
              </div>
              <h2 className="mt-2 text-small font-semibold leading-snug text-primary">
                {application.targetTitle}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
                {application.customerOrganization ? (
                  <span>{application.customerOrganization}</span>
                ) : null}
                <span>подана: {formatDate(application.createdAt)}</span>
              </div>
              {application.note ? (
                <p className="mt-2 text-small leading-relaxed text-secondary">
                  {application.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
