/**
 * T-010. Пилоты Центра (/operations/pilots). Координация пилотных проектов.
 */

import { pilotFixtures } from "@/data/fixtures";
import { StatusBadge } from "@/components/status-badge";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function OperationsPilotsPage() {
  const pilots = pilotFixtures;

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Пилоты
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Координация пилотных проектов: стороны, сроки, статусы и решения.
        </p>
      </header>

      {pilots.length === 0 ? (
        <p className="mt-8 text-small text-secondary">
          Пилоты появятся после старта приёмной кампании.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {pilots.map((pilot) => (
            <li
              key={pilot.id}
              className="rounded-panel border border-subtle bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={pilot.status} size="sm" />
                {isFixtureRecord(pilot) ? <FixtureBadge /> : null}
              </div>
              <h2 className="mt-2 text-small font-semibold leading-snug text-primary">
                {pilot.title}
              </h2>
              <p className="mt-1.5 text-small leading-relaxed text-secondary">
                {pilot.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
                {pilot.customerName ? <span>заказчик: {pilot.customerName}</span> : null}
                {pilot.partnerName ? <span>исполнитель: {pilot.partnerName}</span> : null}
                {pilot.plannedEndAt ? (
                  <span>до {formatDate(pilot.plannedEndAt)}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
