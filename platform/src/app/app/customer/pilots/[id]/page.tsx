/**
 * T-008. Досье пилота заказчика (/customer/pilots/[id]).
 *
 * Статус, содержание, стороны, сроки и ожидаемый результат. История решений
 * и документы пилота — на этапе T-012 (сквозные механики).
 */

import Link from "next/link";
import { Building2, CalendarDays, Factory, Rocket } from "lucide-react";
import { pilotsById } from "@/data/fixtures";
import { isFixtureRecord } from "@/lib/types";
import { getStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/datetime";
import { CustomerNav } from "@/components/customer/customer-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function CustomerPilotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pilot = pilotsById.get(id);

  if (!pilot) {
    return (
      <div className={CONTAINER}>
        <CustomerNav />
        <div className="mt-8">
          <EmptyState
            title="Пилот не найден"
            description="Запись отсутствует, закрыта или недоступна для вашей организации."
            action={
              <Link
                href="/customer/pilots"
                className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                К списку пилотов
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const statusMeta = getStatusMeta(pilot.status);

  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={pilot.status} />
          {isFixtureRecord(pilot) ? <FixtureBadge /> : null}
        </div>
        <h1 className="mt-3 text-h2 font-semibold tracking-tight text-primary">
          {pilot.title}
        </h1>
        <p className="mt-2 max-w-3xl text-small leading-relaxed text-secondary">
          {statusMeta.label}. Дальше: {statusMeta.nextAction}.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section
          aria-labelledby="about-heading"
          className="rounded-panel border border-subtle bg-surface p-6"
        >
          <h2
            id="about-heading"
            className="text-h3 font-semibold tracking-tight text-primary"
          >
            О пилоте
          </h2>
          <p className="mt-3 text-body leading-relaxed text-primary">
            {pilot.description}
          </p>

          {pilot.expectedOutcome ? (
            <div className="mt-5 rounded-panel bg-canvas p-4">
              <p className="text-meta font-medium text-muted">Ожидаемый результат</p>
              <p className="mt-1.5 text-small leading-relaxed text-primary">
                {pilot.expectedOutcome}
              </p>
            </div>
          ) : null}

          {pilot.technologyTitle ? (
            <p className="mt-5 text-meta text-muted">
              Технология: {pilot.technologyTitle}
            </p>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-panel border border-subtle bg-surface p-5">
            <h2 className="text-small font-semibold text-primary">Стороны</h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-meta font-medium text-muted">Заказчик</p>
                  <p className="text-small font-medium text-primary">
                    {pilot.customerName ?? "Не указан"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Factory className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-meta font-medium text-muted">Исполнитель</p>
                  <p className="text-small font-medium text-primary">
                    {pilot.partnerName ?? "Не указан"}
                  </p>
                </div>
              </div>
              {pilot.industry ? (
                <div className="flex items-start gap-2.5">
                  <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <p className="text-meta font-medium text-muted">Отрасль</p>
                    <p className="text-small font-medium text-primary">
                      {pilot.industry}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-panel border border-subtle bg-surface p-5">
            <h2 className="text-small font-semibold text-primary">Сроки</h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-meta font-medium text-muted">Начало</p>
                  <p className="text-small font-medium text-primary">
                    {pilot.startedAt ? formatDate(pilot.startedAt) : "Не указано"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div>
                  <p className="text-meta font-medium text-muted">Плановое завершение</p>
                  <p className="text-small font-medium text-primary">
                    {pilot.plannedEndAt ? formatDate(pilot.plannedEndAt) : "Не указано"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-panel border border-subtle bg-surface p-5">
            <h2 className="text-small font-semibold text-primary">Следующий шаг</h2>
            <p className="mt-2 text-small leading-relaxed text-secondary">
              {statusMeta.nextAction}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
