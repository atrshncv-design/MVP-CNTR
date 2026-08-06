/**
 * T-004. Контролируемые UI-фикстуры пилотов (заказчик × исполнитель × технология).
 *
 * НАЗНАЧЕНИЕ: проверка сценариев пилотов в кабинетах заказчика и партнёра
 * (STATES.md §1): active / blocked / closed.
 *
 * ПРАВИЛА: isFixture: true + label «Тестовый пример для проверки интерфейса»;
 * только непубличные scope; названия явно тестовые.
 */

import { fixtureMarker, type Pilot } from "../../lib/types.ts";

const fixture = fixtureMarker();

export const pilotFixtures: Pilot[] = [
  {
    id: "fixture-pilot-active-01",
    title: "Тестовый пилот: опытная эксплуатация на площадке заказчика",
    description:
      "Тестовый пример для проверки интерфейса в статусе «В работе»: пилот запущен, выполняется следующий этап.",
    status: "active",
    industry: "Промышленность",
    customerName: "Тестовая организация-заказчик",
    partnerName: "Тестовая организация",
    technologyId: "fixture-tech-approved-04",
    technologyTitle: "Тестовая технология: цифровой двойник производственной линии",
    startedAt: "2026-07-15T00:00:00.000Z",
    plannedEndAt: "2026-12-31T00:00:00.000Z",
    expectedOutcome: null,
    ...fixture,
  },
  {
    id: "fixture-pilot-blocked-02",
    title: "Тестовый пилот: интеграция датчиков контроля",
    description:
      "Тестовый пример для проверки интерфейса в статусе «Заблокировано»: показана причина блокировки и следующий шаг.",
    status: "blocked",
    industry: "Приборостроение",
    customerName: "Тестовая организация-заказчик",
    partnerName: "Тестовая организация",
    technologyId: "fixture-tech-clarification-03",
    technologyTitle: "Тестовая технология: датчик контроля вибрации",
    startedAt: "2026-06-01T00:00:00.000Z",
    plannedEndAt: null,
    expectedOutcome: null,
    ...fixture,
  },
  {
    id: "fixture-pilot-closed-03",
    title: "Тестовый пилот: проверка энергоэффективности",
    description:
      "Тестовый пример для проверки интерфейса в статусе «Завершено»: пилот закрыт, итоги доступны участникам.",
    status: "closed",
    industry: "Энергетика",
    customerName: "Тестовая организация-заказчик",
    partnerName: "Тестовая организация",
    technologyId: "fixture-tech-published-06",
    technologyTitle: "Тестовая технология: энергоэффективная система освещения",
    startedAt: "2026-03-01T00:00:00.000Z",
    plannedEndAt: "2026-06-30T00:00:00.000Z",
    expectedOutcome: "Ожидаемый результат — тестовый пример для проверки интерфейса.",
    ...fixture,
  },
];

export const pilotsById: ReadonlyMap<string, Pilot> = new Map(
  pilotFixtures.map((p) => [p.id, p]),
);
