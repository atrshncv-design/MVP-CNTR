/**
 * T-010. Организации Центра (/operations/organizations).
 * РЕАЛЬНЫЕ данные: справочник организаций, производный от карточек НИОКТР
 * (адаптер listOrganizations). Счётчик — из реальных данных.
 */

import { Building2 } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8";

export const dynamic = "force-dynamic";

export default async function OperationsOrganizationsPage() {
  let page;
  try {
    page = await getAdapter().listOrganizations({ pageSize: 50 });
  } catch {
    return (
      <div className={CONTAINER}>
        <ErrorState
          title="Не удалось загрузить организации"
          description="Сервис данных временно недоступен. Повторите попытку позже."
        />
      </div>
    );
  }

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Организации и исполнители
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Реальные организации из реестра НИОКТР (источник: МИНОБРНАУКИ
          России) · {page.total} записей
        </p>
      </header>

      {page.items.length === 0 ? (
        <p className="mt-8 text-small text-secondary">
          Организации появятся после подключения данных.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-panel border border-subtle bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-canvas/60">
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Организация</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Тип</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Регион</th>
                <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Исследований</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-accent-soft/30"
                >
                  <td className="px-4 py-3.5">
                    <p className="flex items-start gap-2 text-small font-medium leading-snug text-primary">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                      {org.name}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-small text-secondary">
                    {org.type ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-small text-secondary">
                    {org.region ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-meta text-secondary">
                    {org.researchCount ?? 0}
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
