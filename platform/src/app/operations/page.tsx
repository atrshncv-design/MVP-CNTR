import Link from "next/link";
import { ArrowRight, Database, Inbox, ListOrdered } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

/**
 * T-003. Рабочее место операционного центра — очередь-first (ROLES.md,
 * «Operations dashboard priority»): приоритетная очередь задач + честные
 * пустые состояния смежных разделов (STATES.md §3). Данные очереди
 * подключает операционный модуль (адаптер, T-004 → T-010).
 */
export default function OperationsWorkspacePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Операционный центр
        </h1>
        <p className="mt-1 max-w-2xl text-small leading-relaxed text-secondary">
          Очередь задач Центра: проверка свидетельств, публикация и решения по
          записям платформы.
        </p>
      </div>

      <EmptyState
        icon={ListOrdered}
        title="Очередь пуста"
        description="Задачи на проверку, публикацию и принятие решений появятся здесь, когда поступят подачи."
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

      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState
          compact
          icon={Inbox}
          title="Новых подач нет"
          description="Технологии и запросы, поданные на проверку, появятся в разделе «Подачи»."
        />
        <EmptyState
          compact
          icon={Database}
          title="Реестр готов к наполнению"
          description="Проверенные и опубликованные записи реестра технологий появятся здесь."
        />
      </div>
    </div>
  );
}
