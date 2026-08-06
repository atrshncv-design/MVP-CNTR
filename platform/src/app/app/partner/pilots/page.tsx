/**
 * T-009. Пилоты исполнителя (/app/partner/pilots).
 *
 * Пилоты с участием организации: фикстуры кабинета + пояснение механики.
 */

import Link from "next/link";
import { Rocket } from "lucide-react";
import { pilotFixtures } from "@/data/fixtures";
import { PartnerNav } from "@/components/partner/partner-nav";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { isFixtureRecord } from "@/lib/types";
import { formatDate } from "@/lib/datetime";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function PartnerPilotsPage() {
  const pilots = pilotFixtures;

  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <header className="max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Пилоты
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Контролируемые испытания ваших технологий на площадках заказчиков:
          задачи, доказательства и решения фиксируются в досье пилота.
        </p>
      </header>

      <div className="mt-6 rounded-panel border border-subtle bg-surface p-6">
        <div className="flex items-start gap-3">
          <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 className="text-h3 font-semibold tracking-tight text-primary">
              Как проходят пилоты
            </h2>
            <p className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
              Проверенная технология → согласование условий с заказчиком →
              пилот с критериями успеха → решение по результатам. Реальные
              пилоты появятся после подключения данных; ниже — примеры
              интерфейса (тестовые записи).
            </p>
          </div>
        </div>
      </div>

      {pilots.length === 0 ? (
        <p className="mt-8 text-small text-secondary">
          Пока нет пилотов с участием вашей организации.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {pilots.map((pilot) => (
            <li key={pilot.id}>
              <Link
                href={`/customer/pilots/${pilot.id}`}
                className="group block rounded-panel border border-subtle bg-surface p-5 transition-colors hover:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={pilot.status} size="sm" />
                  {isFixtureRecord(pilot) ? <FixtureBadge /> : null}
                </div>
                <h2 className="mt-2 text-small font-semibold leading-snug text-primary group-hover:text-accent">
                  {pilot.title}
                </h2>
                <p className="mt-1.5 text-small leading-relaxed text-secondary">
                  {pilot.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
                  {pilot.customerName ? <span>{pilot.customerName}</span> : null}
                  {pilot.technologyTitle ? (
                    <span>{pilot.technologyTitle}</span>
                  ) : null}
                  {pilot.plannedEndAt ? (
                    <span>до {formatDate(pilot.plannedEndAt)}</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
