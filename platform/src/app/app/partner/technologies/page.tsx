/**
 * T-009. Список досье технологий организации (/app/partner/technologies).
 *
 * Карточки со статусом верификации, уровнем УГТ и счётчиком свидетельств
 * (данные кабинета из getWorkspace("partner") + досье-фикстуры с бейджем
 * «Тестовый пример для проверки интерфейса»). «Мои черновики» — досье,
 * созданные формой в этом браузере (localStorage, LocalDrafts).
 */

import Link from "next/link";
import { ArrowRight, FileCheck, Flag, Plus } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { isFixtureRecord } from "@/lib/types";
import { PartnerNav } from "@/components/partner/partner-nav";
import { LocalDrafts } from "@/components/partner/local-drafts";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function PartnerTechnologiesPage() {
  let workspace;
  try {
    workspace = await getAdapter().getWorkspace("partner");
  } catch {
    return (
      <div className={CONTAINER}>
        <PartnerNav />
        <ErrorState
          title="Не удалось загрузить список технологий"
          description="Сервис данных временно недоступен. Повторите попытку позже."
          fallbackHref="/app/partner"
          fallbackLabel="К кабинету"
        />
      </div>
    );
  }

  const technologies = workspace.technologies.items;

  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Технологии организации
          </h1>
          <p className="mt-1.5 text-small text-secondary">
            Досье, путь УГТ и доказательства. Подача на проверку — после
            приложения комплекта свидетельств.
          </p>
        </div>
        <Link
          href="/app/partner/technologies/new"
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Создать технологию
        </Link>
      </header>

      <section aria-labelledby="dossiers-heading" className="mt-8">
        <h2
          id="dossiers-heading"
          className="text-h3 font-semibold tracking-tight text-primary"
        >
          Досье организации
        </h2>
        {technologies.length === 0 ? (
          <div className="mt-4 rounded-panel border border-dashed border-subtle bg-surface p-6 text-center">
            <p className="text-small text-secondary">
              У вашей организации пока нет поданных технологий.{" "}
              <Link
                href="/app/partner/technologies/new"
                className="font-medium text-accent hover:underline"
              >
                Подайте первую
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {technologies.map((tech) => (
              <article
                key={tech.id}
                className="flex flex-col rounded-panel border border-subtle bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-small font-semibold leading-snug text-primary">
                    {tech.title}
                  </h3>
                  {isFixtureRecord(tech) ? <FixtureBadge /> : null}
                </div>
                <p className="mt-2 line-clamp-3 text-meta leading-relaxed text-secondary">
                  {tech.shortDescription}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <UgtBadge level={tech.ugtLevel} />
                  <StatusBadge status={tech.verificationStatus} size="sm" />
                </div>
                <p className="mt-2 text-meta text-muted">
                  {tech.industry ?? "Отрасль не указана"}
                  {typeof tech.availableEvidenceCount === "number"
                    ? ` · свидетельств: ${tech.availableEvidenceCount}`
                    : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-subtle pt-4">
                  <Link
                    href={`/app/partner/technologies/${tech.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control bg-accent-strong px-3 text-meta font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    Досье
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                  <Link
                    href={`/app/partner/technologies/${tech.id}/evidence`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <FileCheck className="h-3.5 w-3.5" aria-hidden />
                    Доказательства
                  </Link>
                  <Link
                    href={`/app/partner/technologies/${tech.id}/path`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-subtle bg-canvas px-3 text-meta font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    Путь УГТ
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Досье, созданные формой в этом браузере */}
      <LocalDrafts />
    </div>
  );
}
