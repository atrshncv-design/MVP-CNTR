/**
 * T-010. Операционный центр — приоритизированная очередь (ROLES.md
 * «Operations dashboard priority»): просроченное → требующие решения →
 * недостающие доказательства → новые записи → кандидаты на публикацию.
 *
 * Очередь — главный объект страницы, не меню: каждый элемент ведёт к
 * объекту (досье/запрос) и следующему действию. Счётчики — ТОЛЬКО из
 * данных очереди (getOperationsQueue) и фикстур реестров; пустая очередь —
 * «Очередь пуста» + время последнего обновления (STATES.md §3 «Empty»).
 */

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CircleAlert,
  Database,
  FileText,
  FlaskConical,
  ListOrdered,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { formatDateTime } from "@/lib/datetime";
import {
  groupQueue,
  queueUpdatedAt,
} from "@/lib/operations";
import {
  customerRequestFixtures,
  pilotFixtures,
  technologyDossierFixtures,
} from "@/data/fixtures";
import { EmptyState } from "@/components/states/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  DueDateCell,
  ObjectTypeLabel,
  PriorityBadge,
  TaskObjectLink,
} from "@/components/operations/ops-task-row";
import type { OperationalTask } from "@/lib/types";

/** Очередь и время обновления — реальный момент проверки данных. */
export const dynamic = "force-dynamic";

interface QueueSectionDef {
  id: string;
  title: string;
  icon: LucideIcon;
  tasks: OperationalTask[];
  tone: string;
}

export default async function OperationsWorkspacePage() {
  const adapter = getAdapter();

  let tasks: OperationalTask[] = [];
  try {
    const page = await adapter.getOperationsQueue({
      pageSize: 100,
      sort: "priority",
    });
    tasks = page.items;
  } catch {
    tasks = [];
  }

  const now = new Date();
  const groups = groupQueue(tasks, now);
  const today = now.toISOString().slice(0, 10);
  const updatedLabel = formatDateTime(queueUpdatedAt(tasks) ?? now.toISOString());

  /* Сводка реестров: счётчики только из реальных/фикстурных данных. */
  let researchTotal = 0;
  let organizationsTotal = 0;
  try {
    const [research, organizations] = await Promise.all([
      adapter.listResearch({ pageSize: 1 }),
      adapter.listOrganizations({ pageSize: 1 }),
    ]);
    researchTotal = research.total;
    organizationsTotal = organizations.total;
  } catch {
    /* сводка реестров не критична для центра */
  }

  const sections: QueueSectionDef[] = [
    {
      id: "overdue",
      title: "Просроченное",
      icon: CalendarClock,
      tasks: groups.overdue,
      tone: "text-status-danger",
    },
    {
      id: "need-decision",
      title: "Требуют решения",
      icon: ListOrdered,
      tasks: groups.needDecision,
      tone: "text-status-warning",
    },
    {
      id: "missing-evidence",
      title: "Недостающие доказательства",
      icon: CircleAlert,
      tasks: groups.missingEvidence,
      tone: "text-status-warning",
    },
    {
      id: "recent",
      title: "Новые записи",
      icon: Sparkles,
      tasks: groups.recent,
      tone: "text-accent",
    },
    {
      id: "publication",
      title: "Кандидаты на публикацию",
      icon: BadgeCheck,
      tasks: groups.publicationCandidates,
      tone: "text-status-success",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Цель страницы и свежесть очереди */}
      <header>
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Операционный центр
        </h1>
        <p className="mt-1 max-w-2xl text-small leading-relaxed text-secondary">
          Очередь задач Центра по приоритету: проверка свидетельств, решения
          по записям и публикация. Откройте объект — и выполните следующее
          действие.
        </p>
        <p className="mt-2 text-meta text-muted">
          Очередь обновлена: <time dateTime={updatedLabel}>{updatedLabel}</time>
          {tasks.length > 0 ? ` · задач в очереди: ${tasks.length}` : ""}
        </p>
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Очередь пуста"
          description={`На ${formatDateTime(now.toISOString())} задач на проверку, решение и публикацию нет. Новые подачи появятся здесь автоматически.`}
          action={
            <Link
              href="/operations/queue"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Открыть очередь
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <QueueSection
              key={section.id}
              section={section}
              today={today}
              queueHref={`/operations/queue?status=${encodeURIComponent("")}`}
            />
          ))}
        </div>
      )}

      {/* Сводка реестров: счётчики из данных, ссылки на разделы */}
      <section aria-labelledby="registry-summary" className="mt-8">
        <h2
          id="registry-summary"
          className="text-h3 font-semibold tracking-tight text-primary"
        >
          Реестры Центра
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <RegistryCard
            href="/operations/technology"
            icon={Database}
            label="Технологии"
            value={technologyDossierFixtures.length}
            source="фикстуры UI"
            real={false}
          />
          <RegistryCard
            href="/operations/requests"
            icon={FileText}
            label="Запросы"
            value={customerRequestFixtures.length}
            source="фикстуры UI"
            real={false}
          />
          <RegistryCard
            href="/operations/pilots"
            icon={Rocket}
            label="Пилоты"
            value={pilotFixtures.length}
            source="фикстуры UI"
            real={false}
          />
          <RegistryCard
            href="/operations/research"
            icon={FlaskConical}
            label="НИОКТР"
            value={researchTotal}
            source="реестр НИОКТР"
            real={true}
          />
          <RegistryCard
            href="/operations/organizations"
            icon={Building2}
            label="Организации"
            value={organizationsTotal}
            source="справочник из НИОКТР"
            real={true}
          />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Секция приоритетной очереди                                         */
/* ------------------------------------------------------------------ */

function QueueSection({
  section,
  today,
  queueHref,
}: {
  section: QueueSectionDef;
  today: string;
  queueHref: string;
}) {
  const Icon = section.icon;
  const visible = section.tasks.slice(0, 3);

  return (
    <section
      aria-labelledby={`section-${section.id}`}
      className="rounded-panel border border-subtle bg-surface p-4 md:p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id={`section-${section.id}`}
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          <Icon className={`h-5 w-5 ${section.tone}`} aria-hidden />
          {section.title}
        </h2>
        <span className="rounded-[6px] bg-canvas px-2 py-0.5 font-mono text-meta text-secondary">
          {section.tasks.length}
        </span>
      </header>

      {section.tasks.length === 0 ? (
        <p className="mt-3 rounded-control border border-dashed border-subtle px-3 py-4 text-center text-meta text-muted">
          В этой группе пока нет задач
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2.5">
            {visible.map((task) => (
              <li
                key={task.id}
                className="rounded-control border border-subtle bg-canvas/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ObjectTypeLabel type={task.objectType} />
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} size="sm" />
                  {task.dueDate ? (
                    <DueDateCell
                      dueDate={task.dueDate}
                      overdue={task.dueDate < today}
                    />
                  ) : null}
                </div>
                <TaskObjectLink task={task} className="mt-2 block text-small" />
                <p className="mt-1.5 line-clamp-2 text-meta leading-relaxed text-secondary">
                  <span className="font-medium text-primary">Действие: </span>
                  {task.nextAction === "—" ? "Задача завершена" : task.nextAction}
                </p>
              </li>
            ))}
          </ul>
          {section.tasks.length > 3 ? (
            <p className="mt-3 text-meta text-muted">
              Показаны первые 3 из {section.tasks.length} — полный список в
              разделе «Очередь».
            </p>
          ) : null}
        </>
      )}
      <footer className="mt-3">
        <Link
          href={queueHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Открыть очередь
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Карточка реестра                                                    */
/* ------------------------------------------------------------------ */

function RegistryCard({
  href,
  icon: Icon,
  label,
  value,
  source,
  real,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  source: string;
  real: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-panel border border-subtle bg-surface p-4 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <span className="flex items-center justify-between gap-2">
        <Icon
          className="h-4 w-4 text-accent transition-colors group-hover:text-accent-strong"
          aria-hidden
        />
        <span
          className={`rounded-[6px] px-1.5 py-0.5 text-meta font-medium ${
            real
              ? "bg-status-success-soft text-status-success"
              : "bg-status-draft-soft text-status-draft"
          }`}
        >
          {real ? "реальные" : "демо"}
        </span>
      </span>
      {/* D-09: главное число реестра — display-шрифт (text-h2), источник — text-meta muted. */}
      <span className="mt-3 block text-h2 font-semibold tracking-tight text-primary">
        {value}
      </span>
      <span className="mt-1 block text-small font-medium text-secondary">
        {label}
      </span>
      <span className="mt-0.5 block text-meta text-muted">{source}</span>
    </Link>
  );
}
