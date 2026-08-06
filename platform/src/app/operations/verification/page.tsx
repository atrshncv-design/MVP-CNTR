/**
 * T-010. Очередь проверки (/operations/verification).
 *
 * Задачи верификации полей и свидетельств из операционной очереди
 * (типы verify / clarification / recheck / onboarding) + записи технологий
 * со статусами проверки. Счётчики — только из данных; каждый элемент ведёт
 * к объекту проверки (досье).
 */

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { formatDate } from "@/lib/datetime";
import { TASK_TYPE_LABELS } from "@/lib/operations";
import { technologySummaryFixtures } from "@/data/fixtures";
import type { OperationalTask, OperationalTaskType } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { OpsQueueTable } from "@/components/operations/ops-queue-table";

/** Типы задач, относящиеся к верификации свидетельств и полей. */
const VERIFICATION_TASK_TYPES: readonly OperationalTaskType[] = [
  "verify",
  "clarification",
  "recheck",
  "onboarding",
];

const VERIFICATION_STATUSES = new Set([
  "under_review",
  "clarification",
  "approval",
]);

export default async function OperationsVerificationPage() {
  let queueTasks: OperationalTask[] = [];
  try {
    const page = await getAdapter().getOperationsQueue({
      pageSize: 100,
      sort: "priority",
    });
    queueTasks = page.items;
  } catch {
    queueTasks = [];
  }

  const verificationTasks = queueTasks.filter((task) =>
    VERIFICATION_TASK_TYPES.includes(task.taskType),
  );

  const technologies = technologySummaryFixtures.filter((tech) =>
    VERIFICATION_STATUSES.has(tech.verificationStatus),
  );

  const today = new Date().toISOString().slice(0, 10);
  const total = verificationTasks.length + technologies.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Проверка
        </h1>
        <p className="mt-1 max-w-2xl text-small leading-relaxed text-secondary">
          Верификация полей и свидетельств: заявки на проверку УГТ,
          запрошенные уточнения и приём в реестр. Откройте объект — проверьте
          комплект и вынесите решение.
        </p>
        <p className="mt-2 text-meta text-muted">
          На проверке: {total} · счётчики из данных очереди и реестра (демо)
        </p>
      </header>

      {verificationTasks.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Задач на проверку нет"
          description="Заявки на верификацию свидетельств появятся здесь, когда участники подадут технологии на проверку."
        />
      ) : (
        <section
          aria-labelledby="verification-queue"
          className="rounded-panel border border-subtle bg-surface p-4 md:p-5"
        >
          <h2
            id="verification-queue"
            className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
          >
            <BadgeCheck className="h-5 w-5 text-accent" aria-hidden />
            Задачи верификации
            <span className="rounded-[6px] bg-canvas px-2 py-0.5 font-mono text-meta text-secondary">
              {verificationTasks.length}
            </span>
          </h2>
          <p className="mt-1 text-meta text-muted">
            Типы: {VERIFICATION_TASK_TYPES.map((t) => TASK_TYPE_LABELS[t]).join(" · ")}
          </p>
          <div className="mt-3">
            <OpsQueueTable tasks={verificationTasks} today={today} />
          </div>
        </section>
      )}

      <section
        aria-labelledby="verification-records"
        className="rounded-panel border border-subtle bg-surface p-4 md:p-5"
      >
        <h2
          id="verification-records"
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          Записи на проверке
          <span className="rounded-[6px] bg-canvas px-2 py-0.5 font-mono text-meta text-secondary">
            {technologies.length}
          </span>
        </h2>
        {technologies.length === 0 ? (
          <p className="mt-3 rounded-control border border-dashed border-subtle px-3 py-5 text-center text-meta text-muted">
            Записей со статусом проверки пока нет
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {technologies.map((tech) => (
              <li
                key={tech.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-subtle bg-canvas/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={tech.verificationStatus} size="sm" />
                    <span className="font-mono text-meta text-muted">
                      УГТ {tech.ugtLevel}
                    </span>
                  </div>
                  <Link
                    href={`/operations/technology/${encodeURIComponent(tech.id)}`}
                    className="mt-1.5 block rounded-control font-medium text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {tech.title}
                  </Link>
                  <p className="mt-1 text-meta text-muted">
                    {tech.organizationName} · обновлено{" "}
                    {formatDate(tech.lastUpdatedAt)}
                  </p>
                </div>
                <Link
                  href={`/operations/technology/${encodeURIComponent(tech.id)}`}
                  className="inline-flex h-10 items-center rounded-control border border-subtle px-4 text-small font-medium text-accent transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Проверить
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
