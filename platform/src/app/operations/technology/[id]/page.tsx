/**
 * T-007. Проверочный dossier сотрудника Центра (/operations/technology/[id]).
 *
 * Контекст очереди (задачи с objectId = id досье), назначенный проверяющий,
 * недостающие свидетельства, история решений (честное пустое состояние),
 * публикация и аудит. Данные — фикстуры кабинета Центра с бейджем.
 */

import Link from "next/link";
import { ArrowLeft, ClipboardCheck, UserRound } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { operationalTaskFixtures } from "@/data/fixtures";
import { buildDossierView } from "@/lib/dossier-views";
import { formatDate } from "@/lib/datetime";
import { DossierHeader } from "@/components/dossier/dossier-header";
import { DossierProblemSolution } from "@/components/dossier/dossier-problem-solution";
import { DossierUgtSummary } from "@/components/dossier/dossier-ugt-summary";
import { DossierDimensions } from "@/components/dossier/dossier-dimensions";
import { DossierEvidence } from "@/components/dossier/dossier-evidence";
import { DossierRelated } from "@/components/dossier/dossier-related";
import { DossierDecisionHistory } from "@/components/dossier/dossier-decision-history";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function OperationsTechnologyDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dossier;
  try {
    dossier = await getAdapter().getTechnology(id, "operations");
  } catch {
    return (
      <div className={CONTAINER}>
        <ErrorState
          title="Не удалось загрузить досье"
          description="Сервис данных временно недоступен. Повторите попытку позже."
          fallbackHref="/operations/technology"
          fallbackLabel="К реестру технологий"
        />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className={CONTAINER}>
        <EmptyState
          title="Досье не найдено"
          description="Запись отсутствует в операционном контуре."
          action={
            <Link
              href="/operations/technology"
              className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              К реестру технологий
            </Link>
          }
        />
      </div>
    );
  }

  const view = buildDossierView(dossier, "operations");
  const queueTasks = operationalTaskFixtures.filter((task) => task.objectId === id);

  return (
    <div className={CONTAINER}>
      <Link
        href="/operations/queue"
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        К очереди
      </Link>

      <div className="mt-4">
        <DossierHeader dossier={dossier} eyebrow="Проверочное досье" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <DossierProblemSolution dossier={dossier} />
          <DossierDimensions dossier={dossier} />
          <DossierEvidence dossier={dossier} />

          {queueTasks.length > 0 ? (
            <section
              aria-labelledby="queue-heading"
              className="rounded-panel border border-subtle bg-surface p-6"
            >
              <h2
                id="queue-heading"
                className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
              >
                <ClipboardCheck className="h-5 w-5 text-accent" aria-hidden />
                Задачи очереди по объекту
              </h2>
              <ul className="mt-4 space-y-3">
                {queueTasks.map((task) => (
                  <li key={task.id} className="rounded-panel bg-canvas p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-small font-semibold text-primary">
                        {task.taskType}
                      </p>
                      <StatusBadge status={task.status} size="sm" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted">
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" aria-hidden />
                        {task.assignee}
                      </span>
                      {task.dueDate ? (
                        <span>срок: {formatDate(task.dueDate)}</span>
                      ) : null}
                      <span>приоритет: {task.priority}</span>
                    </div>
                    {task.missingEvidenceSummary ? (
                      <p className="mt-2 text-small leading-relaxed text-status-warning">
                        Недостающие свидетельства: {task.missingEvidenceSummary}
                      </p>
                    ) : null}
                    <p className="mt-2 text-small leading-relaxed text-secondary">
                      Следующее действие: {task.nextAction}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <DossierRelated dossier={dossier} />
          <DossierDecisionHistory
            decisions={view.decisions}
            emptyLabel="Решений по объекту пока нет. Запишите решение с причиной — оно появится в истории и аудите."
          />
        </div>

        <aside className="space-y-6">
          <DossierUgtSummary dossier={dossier} scope="operations" />
          <section
            aria-labelledby="publish-heading"
            className="rounded-panel border border-subtle bg-surface p-5"
          >
            <h2
              id="publish-heading"
              className="text-small font-semibold text-primary"
            >
              Публикация
            </h2>
            <p className="mt-2 text-small leading-relaxed text-secondary">
              Управление публикацией и решениями появится вместе с операционной
              очередью (T-010). Здесь отображается текущий статус записи.
            </p>
            <div className="mt-3">
              <StatusBadge status={dossier.visibility.publicationStatus} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
