/**
 * T-009. Путь УГТ технологии (/app/partner/technologies/[id]/path).
 *
 * Трек 1–9 с band-разметкой, текущий проверенный уровень ОТДЕЛЬНО от
 * перехода N→N+1 (STATES.md §2), следующий checkpoint и недостающие
 * свидетельства. Компонент PathProgress (T-005/T-011 примитивы).
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { readTechnologyDraft, draftToDossier } from "@/lib/partner-storage";
import { PartnerNav } from "@/components/partner/partner-nav";
import {
  PathProgress,
  isUgtVerified,
  nextCheckpointOf,
} from "@/components/partner/path-progress";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import type { Status } from "@/lib/types";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function PartnerTechnologyPathPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dossier;
  let status: Status = "draft";
  try {
    const found = await getAdapter().getTechnology(id, "participant");
    if (found) {
      dossier = found;
      status = found.visibility.publicationStatus;
    } else {
      const draft = readTechnologyDraft(id);
      if (draft) {
        dossier = draftToDossier(draft);
        status = "draft";
      }
    }
  } catch {
    return (
      <div className={CONTAINER}>
        <PartnerNav />
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
        <PartnerNav />
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

  const verified = isUgtVerified(status);
  const nextCheckpoint = nextCheckpointOf(dossier);

  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <Link
        href={`/app/partner/technologies/${id}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        К досье
      </Link>

      <header className="mt-3 max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Путь готовности технологии
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          УГТ показывает расстояние до конкретного результата внедрения.
          Проверенный уровень отличается от заявленного: подтверждение —
          только после проверки Центром.
        </p>
      </header>

      <div className="mt-8 max-w-4xl">
        <PathProgress
          dossier={dossier}
          status={status}
          transition="preparing"
        />
      </div>

      {nextCheckpoint ? (
        <section
          aria-labelledby="next-heading"
          className="mt-6 max-w-4xl rounded-panel border border-subtle bg-surface p-6"
        >
          <h2
            id="next-heading"
            className="text-h3 font-semibold tracking-tight text-primary"
          >
            Следующий checkpoint
          </h2>
          <p className="mt-2 text-small leading-relaxed text-primary">
            УГТ {nextCheckpoint.level} · {nextCheckpoint.title}
          </p>
          <p className="mt-1.5 text-small leading-relaxed text-secondary">
            {verified
              ? "Текущий уровень подтверждён. Готовьте свидетельства для перехода N→N+1."
              : "Заявленный уровень не подтверждён проверкой — подайте досье на проверку Центром."}
          </p>
        </section>
      ) : null}
    </div>
  );
}
