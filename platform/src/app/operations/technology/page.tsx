/**
 * T-010. Реестр технологий Центра (/operations/technology).
 * Управление записями: таблица досье-фикстур со статусами, публикацией и УГТ.
 */

import Link from "next/link";
import { Layers } from "lucide-react";
import { technologyDossierFixtures } from "@/data/fixtures";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { isFixtureRecord } from "@/lib/types";

const CONTAINER = "mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8";

export default function OperationsTechnologyRegistryPage() {
  const rows = technologyDossierFixtures;

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Реестр технологий
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Записи, поданные на проверку и опубликованные. Откройте досье для
          проверки и решения.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-8 text-small text-secondary">
          Реестр готов к наполнению: первые подачи появятся после старта
          приёмной кампании.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-subtle bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-canvas/60">
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Технология</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">УГТ</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Публикация</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Организация</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((dossier) => (
                <tr
                  key={dossier.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-accent-soft/30"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/operations/technology/${dossier.id}`}
                      className="flex items-start gap-2 text-small font-medium leading-snug text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span>
                        {dossier.title}
                        {isFixtureRecord(dossier) ? (
                          <span className="ml-2 inline-block align-middle">
                            <FixtureBadge />
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <UgtBadge level={dossier.ugt.currentLevel} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <StatusBadge status={dossier.visibility.publicationStatus} size="sm" />
                  </td>
                  <td className="px-4 py-3.5 text-small text-secondary">
                    {dossier.organization.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
