/**
 * T-008. Карточка запроса заказчика (списки: дашборд, requests/).
 * StatusBadge + отрасль + организация + срок + маркировка фикстуры.
 * Вся карточка — ссылка на dossier запроса.
 */

import Link from "next/link";
import { Building2, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { FixtureBadge } from "./fixture-badge";
import { isFixtureRecord, type CustomerRequestSummary } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

export interface RequestCardProps {
  request: CustomerRequestSummary;
  /** Маршрут dossier (по умолчанию — /customer/requests/[id]). */
  href?: string;
  /** Компактный вариант для дашборда. */
  compact?: boolean;
}

export function RequestCard({ request, href, compact = false }: RequestCardProps) {
  const link = href ?? `/customer/requests/${request.id}`;
  return (
    <Link
      href={link}
      className="group block rounded-panel border border-subtle bg-surface p-5 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`font-semibold tracking-tight text-primary group-hover:text-accent ${
            compact ? "text-small leading-snug" : "text-body"
          }`}
        >
          {request.title}
        </h3>
        <StatusBadge status={request.status} size="sm" className="shrink-0" />
      </div>
      <p className="mt-2 line-clamp-2 text-small leading-relaxed text-secondary">
        {request.problemStatement}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {request.industry ? (
          <span className="rounded-control bg-canvas px-2 py-0.5 text-meta font-medium text-secondary">
            {request.industry}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-meta text-muted">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          {request.customerOrganization}
        </span>
        {request.deadline ? (
          <span className="inline-flex items-center gap-1 text-meta text-muted">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            до {formatDate(request.deadline)}
          </span>
        ) : null}
        {isFixtureRecord(request) ? <FixtureBadge className="ml-auto" /> : null}
      </div>
    </Link>
  );
}
