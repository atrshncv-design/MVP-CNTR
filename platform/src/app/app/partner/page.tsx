/**
 * T-009. Дашборд кабинета исполнителя (/app/partner).
 *
 * Приоритет секций — СТРОГО по ROLES.md «Partner dashboard priority»:
 *   1. текущий путь технологии и следующий checkpoint;
 *   2. требующие действия (evidence / clarifications);
 *   3. заявки и запросы заказчиков;
 *   4. активные пилоты;
 *   5. документы и организация.
 *
 * KPI-карточки НЕ декоративные: все числа берутся из данных кабинета
 * (workspace адаптера + досье-фикстур), фейковых счётчиков нет (STATES.md §3).
 * Досье-фикстуры помечены бейджем «Тестовый пример для проверки интерфейса».
 */

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  FileCheck,
  FileText,
  Flag,
  FolderKanban,
  Inbox,
  Plus,
  Rocket,
  UserRound,
} from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { getStatusMeta, type Status } from "@/lib/status";
import { isFixtureRecord } from "@/lib/types";
import {
  customerRequestSummaryFixtures,
  partnerApplicationFixtures,
  technologyDossierFixtures,
  technologySummaryFixtures,
} from "@/data/fixtures";
import { PartnerNav } from "@/components/partner/partner-nav";
import { PathProgress, nextCheckpointOf } from "@/components/partner/path-progress";
import { Sparkline } from "@/components/charts/sparkline";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { ErrorState } from "@/components/states/error-state";
import { formatDate } from "@/lib/datetime";
import type { TechnologyDossier } from "@/lib/types";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

/** Статусы верификации, требующие действия исполнителя (ROLES.md п.2). */
const ACTION_REQUIRED_STATUSES: readonly Status[] = [
  "clarification",
  "action_required",
  "rejected",
];

/**
 * Активность по дням: количество событий на каждый день окна [min,max] дат
 * (пропущенные дни — честные нули, без выдуманных значений; D-05).
 */
function activityByDay(dates: string[]): number[] {
  const days = dates.map((d) => d.slice(0, 10)).sort();
  if (days.length === 0) return [];
  const counts = new Map<string, number>();
  for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
  const first = days[0];
  const last = days[days.length - 1];
  const points: number[] = [];
  const cursor = new Date(`${first}T00:00:00.000Z`);
  const end = new Date(`${last}T00:00:00.000Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    points.push(counts.get(key) ?? 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

/** Статус досье-фикстуры: из карточки (TechnologySummary.verificationStatus). */
function verificationStatusOf(id: string): Status {
  const summary = technologySummaryFixtures.find((t) => t.id === id);
  return summary?.verificationStatus ?? "draft";
}

/** Следующее действие по статусу досье (STATES.md §1 next action). */
function nextActionFor(status: Status, dossier: TechnologyDossier): string {
  if (status === "clarification")
    return "Дополнить свидетельства и ответить на уточнения";
  if (status === "action_required")
    return "Выполнить требующее действия задание";
  if (status === "rejected")
    return "Изучить причину отклонения и доработать досье";
  if (status === "draft") {
    const checkpoint = nextCheckpointOf(dossier);
    return checkpoint
      ? `Продолжить к checkpoint УГТ ${checkpoint.level}`
      : "Продолжить редактирование досье";
  }
  return getStatusMeta(status).nextAction;
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

export default async function PartnerDashboardPage() {
  let workspace;
  try {
    workspace = await getAdapter().getWorkspace("partner");
  } catch {
    return (
      <div className={CONTAINER}>
        <PartnerNav />
        <ErrorState
          title="Не удалось загрузить данные кабинета"
          description="Сервис данных временно недоступен. Повторите попытку или вернитесь к списку технологий."
          fallbackHref="/app/partner/technologies"
          fallbackLabel="К технологиям"
        />
      </div>
    );
  }

  const dossiers = technologyDossierFixtures;
  const pilots = workspace.pilots.items;
  const notifications = workspace.notifications;

  /* 1. Текущий путь технологий и следующий checkpoint (все досье организации). */
  const pathItems = [...dossiers].sort((a, b) =>
    b.visibility.updatedAt.localeCompare(a.visibility.updatedAt),
  );

  /* 2. Требующие действия: досье в clarification/action_required/rejected. */
  const actionRequired = dossiers
    .map((dossier) => ({
      dossier,
      status: verificationStatusOf(dossier.id),
    }))
    .filter(({ status }) => ACTION_REQUIRED_STATUSES.includes(status));

  /* 3. Заявки и запросы заказчиков: открытые запросы (опубликованы/одобрены). */
  const openRequests = customerRequestSummaryFixtures.filter(
    (request) =>
      request.publicationStatus === "published" ||
      request.status === "approved" ||
      request.status === "published",
  );
  const applicationsCount = partnerApplicationFixtures.length;

  /* 4. Активные пилоты (blocked — в секции «Требуют действия»). */
  const activePilots = pilots.filter((pilot) => pilot.status === "active");
  const blockedPilots = pilots.filter((pilot) => pilot.status === "blocked");

  /* KPI — только из данных кабинета. */
  const kpis = [
    {
      label: "Технологий",
      value: workspace.technologies.total,
      note: "в портфеле организации",
    },
    {
      label: "Требуют действия",
      value: actionRequired.length + blockedPilots.length,
      note: "досье и пилотов",
    },
    {
      label: "Активные пилоты",
      value: activePilots.length,
      note: "с участием организации",
    },
    {
      label: "Открытых запросов",
      value: openRequests.length,
      note: "заказчиков, куда можно подать заявку",
    },
  ];

  const orgName = workspace.technologies.items[0]?.organizationName ?? null;

  /* D-05: активность обновлений досье по дням (реальные даты фикстур). */
  const dossierActivity = activityByDay(dossiers.map((d) => d.visibility.updatedAt));

  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Кабинет исполнителя
          </h1>
          <p className="mt-1.5 text-small text-secondary">
            {orgName ? `Организация: ${orgName}` : "Организация пока не указана"}
            <span className="text-muted"> · данные кабинета (демо-режим)</span>
          </p>
        </div>
        <Link
          href="/app/partner/technologies/new"
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Представить технологию
        </Link>
      </header>

      {/* KPI */}
      <section
        aria-label="Показатели кабинета"
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} note={kpi.note} />
        ))}
      </section>

      {/* D-05: активность по дням (обновления досье; даты фикстур кабинета). */}
      <section aria-label="Активность" className="mt-8">
        <SectionHeading title="Активность" />
        <div className="rounded-panel border border-subtle bg-surface p-5">
          {dossierActivity.length >= 2 ? (
            <>
              <h3 className="text-small font-semibold text-primary">
                Обновления досье по дням
              </h3>
              <div className="mt-3">
                <Sparkline
                  points={dossierActivity}
                  ariaLabel="Активность: количество обновлений досье по дням"
                />
              </div>
              <p className="mt-3 text-meta text-muted">
                Источник: фикстуры UI (демо) — даты обновлений досье кабинета.
              </p>
            </>
          ) : (
            <p className="text-small text-secondary">
              График появится после накопления данных.
            </p>
          )}
        </div>
      </section>

      {/* 1. Текущий путь и следующий checkpoint */}
      <section aria-labelledby="path-heading" className="mt-8">
        <SectionHeading
          title="Путь технологий и следующий checkpoint"
          href="/app/partner/technologies"
          linkLabel="Все технологии"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {pathItems.map((dossier) => {
            const status = verificationStatusOf(dossier.id);
            const checkpoint = nextCheckpointOf(dossier);
            return (
              <div
                key={dossier.id}
                className="rounded-panel border border-subtle bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-small font-semibold leading-snug text-primary">
                      {dossier.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <UgtBadge level={dossier.ugt.currentLevel} showBand={false} />
                      <StatusBadge status={status} size="sm" />
                      {isFixtureRecord(dossier) ? <FixtureBadge /> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <PathProgress dossier={dossier} status={status} transition="not_started" compact />
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-muted">
                  <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  {checkpoint
                    ? `Следующий checkpoint: УГТ ${checkpoint.level} · ${checkpoint.title}`
                    : "Checkpoint'ов в досье пока нет."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/app/partner/technologies/${dossier.id}/path`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    Путь УГТ
                  </Link>
                  <Link
                    href={`/app/partner/technologies/${dossier.id}/evidence`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <FileCheck className="h-3.5 w-3.5" aria-hidden />
                    Доказательства
                  </Link>
                  <Link
                    href={`/app/partner/technologies/${dossier.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    Досье
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Требуют действия */}
      <section aria-labelledby="action-heading" className="mt-8">
        <SectionHeading
          title="Требуют действия"
          href={actionRequired.length + blockedPilots.length > 0 ? undefined : "/app/partner/technologies"}
          linkLabel={actionRequired.length + blockedPilots.length > 0 ? undefined : "Все технологии"}
        />
        {actionRequired.length + blockedPilots.length === 0 ? (
          <div className="rounded-panel border border-subtle bg-surface p-5">
            <p className="flex items-center gap-2 text-small text-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-status-success" aria-hidden />
              Действий не требуется — досье и пилоты в порядке.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {actionRequired.map(({ dossier, status }) => (
              <li key={dossier.id}>
                <Link
                  href={`/app/partner/technologies/${dossier.id}/evidence`}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-panel border border-status-warning/50 bg-surface p-4 transition-colors hover:border-status-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-small font-semibold text-primary">
                      <StatusBadge status={status} size="sm" />
                      <span className="truncate">{dossier.title}</span>
                    </p>
                    <p className="mt-1 text-meta text-muted">
                      Следующий шаг: {nextActionFor(status, dossier)}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-accent"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
            {blockedPilots.map((pilot) => (
              <li key={pilot.id}>
                <Link
                  href="/app/partner/pilots"
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-panel border border-status-danger/40 bg-surface p-4 transition-colors hover:border-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-small font-semibold text-primary">
                      <StatusBadge status={pilot.status} size="sm" />
                      <span className="truncate">{pilot.title}</span>
                    </p>
                    <p className="mt-1 text-meta text-muted">
                      Пилот заблокирован — устраните блокер, чтобы продолжить.
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

      {/* 3. Заявки и запросы заказчиков */}
      <section aria-labelledby="requests-heading" className="mt-8">
        <SectionHeading
          title="Заявки и запросы заказчиков"
          href="/app/partner/requests"
          linkLabel="Все запросы"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-small font-semibold text-primary">
              <Inbox className="h-4 w-4 text-accent" aria-hidden />
              Открытые запросы
            </h3>
            {openRequests.length === 0 ? (
              <div className="rounded-panel border border-dashed border-subtle bg-surface p-5 text-small text-secondary">
                Открытых запросов заказчиков пока нет.
              </div>
            ) : (
              <ul className="space-y-3">
                {openRequests.slice(0, 3).map((request) => (
                  <li key={request.id}>
                    <Link
                      href="/app/partner/requests"
                      className="group block rounded-panel border border-subtle bg-surface p-4 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-small font-semibold text-primary group-hover:text-accent">
                          {request.title}
                        </p>
                        <StatusBadge status={request.status} size="sm" className="shrink-0" />
                      </div>
                      <p className="mt-1.5 text-meta text-muted">
                        {request.customerOrganization}
                        {request.deadline ? ` · до ${formatDate(request.deadline)}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-small font-semibold text-primary">
              <FolderKanban className="h-4 w-4 text-accent" aria-hidden />
              Заявки
            </h3>
            <Link
              href="/app/partner/applications"
              className="group block rounded-panel border border-subtle bg-surface p-4 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <p className="text-small font-semibold text-primary group-hover:text-accent">
                {applicationsCount} заявки на запросы и пилоты
              </p>
              <p className="mt-1 text-meta leading-relaxed text-muted">
                Подача на открытые запросы — со страницы запросов заказчиков;
                статусы заявок обновляются здесь.
              </p>
              <p className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-accent">
                Открыть заявки
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Активные пилоты */}
      <section aria-labelledby="pilots-heading" className="mt-8">
        <SectionHeading title="Активные пилоты" href="/app/partner/pilots" linkLabel="Все пилоты" />
        {activePilots.length === 0 ? (
          <div className="rounded-panel border border-dashed border-subtle bg-surface p-5 text-small text-secondary">
            Активных пилотов нет. Пилоты появятся после подачи заявки на запрос
            заказчика и её одобрения.
          </div>
        ) : (
          <ul className="space-y-3">
            {activePilots.map((pilot) => (
              <li key={pilot.id}>
                <Link
                  href="/app/partner/pilots"
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-panel border border-subtle bg-surface p-4 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-small font-semibold text-primary">
                      <Rocket className="h-4 w-4 text-accent" aria-hidden />
                      <span className="truncate">{pilot.title}</span>
                    </p>
                    <p className="mt-1 text-meta text-muted">
                      {pilot.technologyTitle ?? "Технология уточняется"}
                      {pilot.customerName ? ` · ${pilot.customerName}` : ""}
                      {pilot.plannedEndAt ? ` · до ${formatDate(pilot.plannedEndAt)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={pilot.status} size="sm" className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5. Документы и организация */}
      <section aria-labelledby="org-heading" className="mt-8">
        <SectionHeading title="Документы и организация" />
        <div className="rounded-panel border border-subtle bg-surface p-5">
          <p className="text-small leading-relaxed text-secondary">
            Реквизиты организации, доступы и документы кабинета. Документы по
            досье появятся после начала проверки Центром.
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
            Уведомления о статусах досье, уточнениях и решениях приходят в
            кабинет ({notifications.filter((n) => !n.read).length} непрочитанных).
          </p>
        </div>
      </section>
    </div>
  );
}
