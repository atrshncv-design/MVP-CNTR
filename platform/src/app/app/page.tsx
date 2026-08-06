"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import {
  APP_SECTIONS,
  SECTION_EMPTY_STATES,
  getRoleDefinition,
  type SectionDef,
} from "@/lib/roles";
import { getMockSession, type MockSession } from "@/lib/session";

/**
 * T-003. Страница Workspace — рабочее место-заглушка с честными пустыми
 * состояниями (STATES.md §3): для каждой роли показываются её приоритетные
 * разделы и объяснение, почему там пока пусто + следующее действие.
 * Снимок воркспейса (адаптер, T-004) наполняет разделы данными в тикетах
 * кабинетов (T-008/T-009).
 */
export default function WorkspacePage() {
  const [session, setSession] = useState<MockSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      setSession(getMockSession());
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return <LoadingSkeleton variant="list" rows={3} label="Загружаем рабочее место" />;
  }
  /* Без сессии layout уже редиректит на /login — здесь не рендерим контент. */
  if (!session) return null;

  const definition = getRoleDefinition(session.role);
  const roleSections = (definition?.sections ?? [])
    .map((id) => APP_SECTIONS.find((section) => section.id === id))
    .filter((section): section is SectionDef => Boolean(section));

  /* Два приоритетных раздела роли — превью рабочего места. */
  const preview = roleSections.slice(0, 2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Workspace
        </h1>
        <p className="mt-1 max-w-2xl text-small leading-relaxed text-secondary">
          {definition?.label ?? session.role} —{" "}
          {definition?.description ?? "Рабочее место участника платформы"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {preview.map((section) => {
          const empty = SECTION_EMPTY_STATES[section.id];
          const action = empty?.action ?? { label: "Открыть раздел", href: section.href };
          return (
            <EmptyState
              key={section.id}
              icon={section.icon}
              title={empty?.title ?? "Пока нет записей"}
              description={
                empty?.description ??
                "Раздел готов к наполнению: записи появятся после подключения данных."
              }
              action={
                <Link
                  href={action.href}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              }
            />
          );
        })}
      </div>

      <p className="text-meta leading-relaxed text-muted">
        Снимок рабочего пространства — задачи, заявки и документы — появится
        здесь после подключения источника данных.
      </p>
    </div>
  );
}
