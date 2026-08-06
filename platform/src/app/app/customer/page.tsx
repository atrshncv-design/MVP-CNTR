/**
 * T-008. Дашборд кабинета заказчика (/customer).
 *
 * Приоритет секций — СТРОГО по ROLES.md «Customer dashboard priority»:
 *   1. срочные задачи (рабочая очередь);
 *   2. активные запросы и пилоты;
 *   3. свежие проверенные технологии;
 *   4. шорт-листы;
 *   5. профиль и документы.
 *
 * KPI-карточки НЕ декоративные: все числа берутся из данных кабинета
 * (workspace адаптера / фикстур), фейковых счётчиков нет (STATES.md §3).
 * Срочная очередь — производная от объектов заказчика: запросы в статусах
 * clarification/action_required и заблокированные пилоты.
 */

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  FileText,
  ListChecks,
  Plus,
  Rocket,
  UserRound,
} from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { getStatusMeta, type Status } from "@/lib/status";
import { isFixtureRecord } from "@/lib/types";
import { technologyDossierFixtures, technologySummaryFixtures } from "@/data/fixtures";
import { CustomerNav } from "@/components/customer/customer-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { RequestCard } from "@/components/customer/request-card";
import { ShortlistButton } from "@/components/customer/shortlist-button";
import { ShortlistSummary } from "@/components/customer/shortlist";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { ErrorState } from "@/components/states/error-state";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

/** Статусы, которые заказчик считает «в работе» (не черновик/закрыт/архив). */
const ACTIVE_REQUEST_STATUSES: readonly Status[] = [
  "under_review",
  "clarification",
  "approval",
  "approved",
  "published",
  "active",
];

interface UrgentItem {
  kind: "request" | "pilot";
  id: string;
  title: string;
  status: Status;
  nextAction: string;
  href: string;
}

function KpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-panel border border-subtle bg-surface p-5">
      <p className="text-meta font-medium text-muted">{label}</p>
      <p className="mt-1.5 font-mono text-h3 font-semibold tracking-tight text-primary">
        {value}
      </p>
      <p className="mt-1 text-meta leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-h3 font-semibold tracking-tight text-primary">{title}</h2>
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex h-9 items-center gap-1 rounded-control px-3 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export default async function CustomerDashboardPage() {
  let workspace;
  try {
    workspace = await getAdapter().getWorkspace("customer");
  } catch {
    return (
      <div className={CONTAINER}>
        <CustomerNav />
        <ErrorState
          title="Не удалось загрузить данные кабинета"
          description="Сервис данных временно недоступен. Повторите попытку или вернитесь к списку запросов."
          fallbackHref="/customer/requests"
          fallbackLabel="К запросам"
        />
      </div>
    );
  }

  const requests = workspace.requests.items;
  const pilots = workspace.pilots.items;
  const notifications = workspace.notifications;

  /* 1. Рабочая очередь срочных задач (объекты заказчика, требующие действия). */
  const urgent: UrgentItem[] = [
    ...requests
      .filter((r) => r.status === "clarification" || r.status === "action_required")
      .map((r) => ({
        kind: "request" as const,
        id: r.id,
        title: r.title,
        status: r.status,
        nextAction: getStatusMeta(r.status).nextAction,
        href: `/customer/requests/${r.id}`,
      })),
    ...pilots
      .filter((p) => p.status === "blocked")
      .map((p) => ({
        kind: "pilot" as const,
        id: p.id,
        title: p.title,
        status: p.status,
        nextAction: getStatusMeta(p.status).nextAction,
        href: `/customer/pilots/${p.id}`,
      })),
  ];

  /* 2. Активные запросы и пилоты. */
  const activeRequests = requests.filter((r) =>
    ACTIVE_REQUEST_STATUSES.includes(r.status),
  );
  const activePilots = pilots.filter((p) => p.status === "active" || p.status === "blocked");

  /* 3. Свежие проверенные технологии (фикстуры кабинета, помеченные бейджем). */
  const freshTechnologies = [...technologySummaryFixtures]
    .filter(
      (t) => t.verificationStatus === "published" || t.verificationStatus === "approved",
    )
    .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
    .slice(0, 3);

  /* KPI — только реальные/фикстурные данные кабинета. */
  const kpis = [
    {
      label: "Срочных задач",
      value: urgent.length,
      note: "требуют вашего действия",
    },
    {
      label: "Запросы в работе",
      value: activeRequests.length,
      note: `из ${requests.length} всего`,
    },
    {
      label: "Активные пилоты",
      value: pilots.filter((p) => p.status === "active").length,
      note: "с участием организации",
    },
    {
      label: "Новых уведомлений",
      value: notifications.filter((n) => !n.read).length,
      note: "в кабинете",
    },
  ];

  const orgName = requests[0]?.customerOrganization ?? null;

  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Кабинет заказчика
          </h1>
          <p className="mt-1.5 text-small text-secondary">
            {orgName
              ? `Организация: ${orgName}`
              : "Организация пока не указана"}
            <span className="text-muted"> · данные кабинета (демо-режим)</span>
          </p>
        </div>
        <Link
          href="/customer/requests/new"
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Создать запрос
        </Link>
      </header>

      {/* KPI */}
      <section aria-label="Показатели кабинета" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} note={kpi.note} />
        ))}
      </section>

      {/* 1. Рабочая очередь */}
      <section aria-labelledby="urgent-heading" className="mt-8">
        <SectionHeading
          title="Срочные задачи"
          href={urgent.length > 0 ? undefined : "/customer/requests"}
          linkLabel={urgent.length > 0 ? undefined : "Все запросы"}
        />
        {urgent.length === 0 ? (
          <div className="rounded-panel border border-subtle bg-surface p-5">
            <p className="flex items-center gap-2 text-small text-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-status-success" aria-hidden />
              Срочных задач нет — все запросы и пилоты в порядке.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {urgent.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.href}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-panel border border-status-warning/50 bg-surface p-4 transition-colors hover:border-status-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-small font-semibold text-primary">
                      <StatusBadge status={item.status} size="sm" />
                      <span className="truncate">{item.title}</span>
                    </p>
                    <p className="mt-1 text-meta text-muted">
                      Следующий шаг: {item.nextAction}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Активные запросы и пилоты */}
      <section aria-labelledby="active-heading" className="mt-8">
        <SectionHeading title="Запросы и пилоты" href="/customer/requests" linkLabel="Все запросы" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-small font-semibold text-primary">
              <ListChecks className="h-4 w-4 text-accent" aria-hidden />
              Активные запросы
            </h3>
            {activeRequests.length === 0 ? (
              <div className="rounded-panel border border-dashed border-subtle bg-surface p-5 text-small text-secondary">
                Активных запросов нет.{" "}
                <Link href="/customer/requests/new" className="font-medium text-accent hover:underline">
                  Создайте первый запрос
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {activeRequests.map((request) => (
                  <RequestCard key={request.id} request={request} compact />
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-small font-semibold text-primary">
              <Rocket className="h-4 w-4 text-accent" aria-hidden />
              Пилоты
            </h3>
            {activePilots.length === 0 ? (
              <div className="rounded-panel border border-dashed border-subtle bg-surface p-5 text-small text-secondary">
                Пилоты появятся после одобрения запроса и подбора исполнителей.{" "}
                <Link href="/customer/pilots" className="font-medium text-accent hover:underline">
                  Как устроены пилоты
                </Link>
                .
              </div>
            ) : (
              <ul className="space-y-3">
                {activePilots.map((pilot) => (
                  <li key={pilot.id}>
                    <Link
                      href={`/customer/pilots/${pilot.id}`}
                      className="group block rounded-panel border border-subtle bg-surface p-4 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-small font-semibold text-primary group-hover:text-accent">
                          {pilot.title}
                        </p>
                        <StatusBadge status={pilot.status} size="sm" className="shrink-0" />
                      </div>
                      <p className="mt-1.5 text-meta text-muted">
                        {pilot.technologyTitle ?? "Технология уточняется"}
                        {pilot.plannedEndAt ? ` · до ${formatDate(pilot.plannedEndAt)}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 3. Свежие проверенные технологии */}
      <section aria-labelledby="fresh-heading" className="mt-8">
        <SectionHeading title="Свежие проверенные технологии" href="/customer/search" linkLabel="Искать решения" />
        <div className="grid gap-4 md:grid-cols-3">
          {freshTechnologies.map((tech) => (
            <div key={tech.id} className="flex flex-col rounded-panel border border-subtle bg-surface p-5">
              <h3 className="text-small font-semibold leading-snug text-primary">{tech.title}</h3>
              <p className="mt-2 line-clamp-2 text-meta leading-relaxed text-secondary">
                {tech.shortDescription}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <UgtBadge level={tech.ugtLevel} />
                <StatusBadge status={tech.verificationStatus} size="sm" />
              </div>
              {isFixtureRecord(tech) ? (
                <div className="mt-3">
                  <FixtureBadge />
                </div>
              ) : null}
              <div className="mt-4">
                <ShortlistButton technologyId={tech.id} title={tech.title} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Шорт-листы */}
      <section aria-labelledby="shortlists-heading" className="mt-8">
        <SectionHeading title="Шорт-листы" href="/customer/shortlists" linkLabel="Сравнить" />
        <ShortlistSummary technologies={technologyDossierFixtures} />
      </section>

      {/* 5. Профиль и документы */}
      <section aria-labelledby="profile-heading" className="mt-8">
        <SectionHeading title="Профиль и документы" />
        <div className="rounded-panel border border-subtle bg-surface p-5">
          <p className="text-small leading-relaxed text-secondary">
            Реквизиты организации, доступы и документы кабинета. Документы и
            решения появятся после начала проверки запросов Центром.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            <li>
              <Link
                href="/app/profile"
                className="inline-flex h-10 items-center gap-2 rounded-control border border-subtle bg-canvas px-4 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <UserRound className="h-4 w-4" aria-hidden />
                Профиль
              </Link>
            </li>
            <li>
              <Link
                href="/app/organization"
                className="inline-flex h-10 items-center gap-2 rounded-control border border-subtle bg-canvas px-4 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <ListChecks className="h-4 w-4" aria-hidden />
                Организация
              </Link>
            </li>
            <li>
              <Link
                href="/app/documents"
                className="inline-flex h-10 items-center gap-2 rounded-control border border-subtle bg-canvas px-4 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Документы
              </Link>
            </li>
          </ul>
          <p className="mt-4 flex items-center gap-2 text-meta text-muted">
            <BellRing className="h-3.5 w-3.5" aria-hidden />
            Уведомления о статусах запросов и решений приходят в кабинет.
          </p>
        </div>
      </section>
    </div>
  );
}
