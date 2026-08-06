/**
 * T-008. Dossier запроса заказчика (/customer/requests/[id]).
 *
 * Статус по STATES.md, содержание запроса, совпадения с технологиями
 * (MatchList резолвит досье по id из TechnologyMatch), связанный пилот,
 * контекстные комментарии (STATES.md §5).
 */

import Link from "next/link";
import { Building2, CalendarDays, FlaskConical, ListChecks, Rocket } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { getStatusMeta } from "@/lib/status";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";
import { CustomerNav } from "@/components/customer/customer-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { MatchList, type MatchedTechnologyView } from "@/components/customer/match-list";
import { CommentBox } from "@/components/customer/comment-box";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
      <div>
        <p className="text-meta font-medium text-muted">{label}</p>
        <p className="text-small font-medium text-primary">{value}</p>
      </div>
    </div>
  );
}

export default async function CustomerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request;
  try {
    request = await getAdapter().getCustomerRequest(id, "participant");
  } catch {
    return (
      <div className={CONTAINER}>
        <CustomerNav />
        <ErrorState
          title="Не удалось загрузить запрос"
          description="Сервис данных временно недоступен. Повторите попытку позже."
          fallbackHref="/customer/requests"
          fallbackLabel="К запросам"
        />
      </div>
    );
  }

  if (!request) {
    return (
      <div className={CONTAINER}>
        <CustomerNav />
        <div className="mt-8">
          <EmptyState
            title="Запрос не найден"
            description="Запись отсутствует, закрыта или недоступна для вашей организации."
            action={
              <Link
                href="/customer/requests"
                className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                К списку запросов
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  /* Совпадения: TechnologyMatch.requestId хранит id технологии (контракт T-004). */
  const matches: MatchedTechnologyView[] = [];
  for (const match of request.matchedTechnologies) {
    const technology = await getAdapter()
      .getTechnology(match.requestId, "participant")
      .catch(() => null);
    matches.push({ match, technology });
  }

  const statusMeta = getStatusMeta(request.status);
  const isFixture = isFixtureRecord(request);

  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={request.status} />
          {isFixture ? <FixtureBadge /> : null}
        </div>
        <h1 className="mt-3 text-h2 font-semibold tracking-tight text-primary">
          {request.title}
        </h1>
        <p className="mt-2 max-w-3xl text-small leading-relaxed text-secondary">
          {statusMeta.label}. Дальше: {statusMeta.nextAction}.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
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
              <p className="text-meta font-medium text-muted">
                Желаемый результат
              </p>
              <p className="mt-1.5 text-small leading-relaxed text-primary">
                {request.desiredCapability}
              </p>
            </div>

            {request.implementationContext ? (
              <div className="mt-5">
                <p className="text-meta font-medium text-muted">
                  Контекст внедрения
                </p>
                <p className="mt-1.5 text-small leading-relaxed text-secondary">
                  {request.implementationContext}
                </p>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="matches-heading" className="rounded-panel border border-subtle bg-surface p-6">
            <h2
              id="matches-heading"
              className="text-h3 font-semibold tracking-tight text-primary"
            >
              Совпадения с технологиями
            </h2>
            <p className="mt-1.5 text-meta text-muted">
              Проверенные технологии и исполнители, подобранные под запрос
            </p>
            <div className="mt-4">
              <MatchList matches={matches} />
            </div>
          </section>

          {request.relatedPilot ? (
            <section
              aria-labelledby="pilot-heading"
              className="rounded-panel border border-subtle bg-surface p-6"
            >
              <h2
                id="pilot-heading"
                className="text-h3 font-semibold tracking-tight text-primary"
              >
                Связанный пилот
              </h2>
              <p className="mt-2 text-small leading-relaxed text-secondary">
                {request.relatedPilot.description}
              </p>
              <Link
                href={`/customer/pilots/${request.relatedPilot.id}`}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <Rocket className="h-3.5 w-3.5" aria-hidden />
                Открыть пилот
              </Link>
            </section>
          ) : null}

          <section
            aria-labelledby="comments-heading"
            className="rounded-panel border border-subtle bg-surface p-6"
          >
            <h2
              id="comments-heading"
              className="text-h3 font-semibold tracking-tight text-primary"
            >
              Комментарии
            </h2>
            <p className="mt-1.5 text-meta text-muted">
              Контекстные обсуждения запроса — с Центром и исполнителями
            </p>
            <div className="mt-4">
              <CommentBox objectId={request.id} />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-panel border border-subtle bg-surface p-5">
            <h2 className="text-small font-semibold text-primary">
              Данные запроса
            </h2>
            <div className="mt-4 space-y-4">
              <MetaItem
                icon={Building2}
                label="Организация"
                value={request.customerOrganization}
              />
              <MetaItem icon={FlaskConical} label="Отрасль" value={request.industry} />
              <MetaItem
                icon={CalendarDays}
                label="Создан"
                value={request.createdAt ? formatDate(request.createdAt) : null}
              />
              <MetaItem
                icon={CalendarDays}
                label="Срок"
                value={request.deadline ? formatDate(request.deadline) : null}
              />
            </div>
          </div>

          <div className="rounded-panel border border-subtle bg-surface p-5">
            <h2 className="text-small font-semibold text-primary">
              Следующий шаг
            </h2>
            <p className="mt-2 text-small leading-relaxed text-secondary">
              {statusMeta.nextAction}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
