/**
 * T-007. Рабочий dossier исполнителя (/app/partner/technologies/[id]).
 *
 * Данные кабинета: досье-фикстуры (с бейджем «Тестовый пример для проверки
 * интерфейса»). Секции: проблема/решение, УГТ + переход N→N+1, 4 измерения,
 * checkpoint'ы, доказательства, связанные записи, комментарии (локальный
 * демо-режим), видимость. Полноценный кабинет партнёра — T-009.
 */

import Link from "next/link";
import { ArrowLeft, ListChecks } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { buildDossierView } from "@/lib/dossier-views";
import { DossierHeader } from "@/components/dossier/dossier-header";
import { DossierProblemSolution } from "@/components/dossier/dossier-problem-solution";
import { DossierUgtSummary } from "@/components/dossier/dossier-ugt-summary";
import { DossierDimensions } from "@/components/dossier/dossier-dimensions";
import { DossierEvidence } from "@/components/dossier/dossier-evidence";
import { DossierRelated } from "@/components/dossier/dossier-related";
import { DossierVisibility } from "@/components/dossier/dossier-visibility";
import { DossierDecisionHistory } from "@/components/dossier/dossier-decision-history";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function PartnerTechnologyDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dossier;
  try {
    dossier = await getAdapter().getTechnology(id, "participant");
  } catch {
    return (
      <div className={CONTAINER}>
        <ErrorState
          title="Не удалось загрузить досье"
          description="Сервис данных временно недоступен. Повторите попытку позже."
          fallbackHref="/app/partner/technologies"
          fallbackLabel="К технологиям"
        />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className={CONTAINER}>
        <EmptyState
          title="Досье не найдено"
          description="Запись отсутствует или недоступна для вашей организации."
          action={
            <Link
              href="/app/partner/technologies"
              className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              К списку технологий
            </Link>
          }
        />
      </div>
    );
  }

  const view = buildDossierView(dossier, "participant");

  return (
    <div className={CONTAINER}>
      <Link
        href="/app/partner/technologies"
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        К технологиям организации
      </Link>

      <div className="mt-4">
        <DossierHeader dossier={dossier} eyebrow="Рабочее досье" showFixtureBadge />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <DossierProblemSolution dossier={dossier} />
          <DossierDimensions dossier={dossier} />
          <DossierEvidence dossier={dossier} />

          {dossier.checkpoints.length > 0 ? (
            <section
              aria-labelledby="checkpoints-heading"
              className="rounded-panel border border-subtle bg-surface p-6"
            >
              <h2
                id="checkpoints-heading"
                className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
              >
                <ListChecks className="h-5 w-5 text-accent" aria-hidden />
                Checkpoint&apos;ы пути
              </h2>
              <ul className="mt-4 space-y-3">
                {dossier.checkpoints.map((checkpoint) => (
                  <li
                    key={checkpoint.id}
                    className="rounded-panel bg-canvas p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-small font-semibold text-primary">
                        УГТ {checkpoint.level} · {checkpoint.title}
                      </p>
                      <span className="font-mono text-meta text-muted">
                        свидетельств: {checkpoint.evidenceCount}
                      </span>
                    </div>
                    {checkpoint.dueDate ? (
                      <p className="mt-1 text-meta text-muted">
                        Срок: {checkpoint.dueDate}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <DossierRelated dossier={dossier} />
          <DossierDecisionHistory
            decisions={view.decisions}
            emptyLabel="Решений по технологии пока нет. История появится после подачи на проверку."
          />
        </div>

        <aside className="space-y-6">
          <DossierUgtSummary dossier={dossier} scope="participant" />
          <DossierVisibility dossier={dossier} />
        </aside>
      </div>
    </div>
  );
}
