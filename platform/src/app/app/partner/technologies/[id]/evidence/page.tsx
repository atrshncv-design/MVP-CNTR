/**
 * T-009. Доказательства и документы досье (/app/partner/technologies/[id]/evidence).
 *
 * EvidenceWorkspace: состояния загрузки по STATES.md §6 (выбрано/загружается/
 * проверяется/принято/отклонено/ошибка+retry), «принято» — только после
 * завершения (mock) валидации. Черновики из localStorage поддерживаются.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { readTechnologyDraft, draftToDossier } from "@/lib/partner-storage";
import { PartnerNav } from "@/components/partner/partner-nav";
import { EvidenceWorkspace } from "@/components/partner/evidence-workspace";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function PartnerEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let initialDossier = null;
  let initialStatus: "draft" | "under_review" | "approved" = "draft";
  try {
    const dossier = await getAdapter().getTechnology(id, "participant");
    if (dossier) {
      initialDossier = dossier;
      initialStatus = dossier.visibility.publicationStatus as typeof initialStatus;
    } else {
      const draft = readTechnologyDraft(id);
      if (draft) {
        initialDossier = draftToDossier(draft);
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

  if (!initialDossier) {
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
          Доказательства и документы
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Свидетельства, подтверждающие текущий уровень готовности. «Принято»
          появляется только после завершения проверки файла; требования к
          доказательствам — в разделе «Путь УГТ».
        </p>
      </header>

      <div className="mt-6 max-w-4xl">
        <EvidenceWorkspace
          id={id}
          initialDossier={initialDossier}
          initialStatus={initialStatus}
        />
      </div>
    </div>
  );
}
