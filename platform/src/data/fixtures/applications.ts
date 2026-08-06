/**
 * T-009. Контролируемые UI-фикстуры заявок исполнителя.
 *
 * НАЗНАЧЕНИЕ: проверка сценариев заявок на запросы заказчиков и пилоты
 * в кабинете партнёра (STATES.md §1): under_review / clarification /
 * approved / rejected / active. Заявки, созданные самим исполнителем
 * (кнопка «Подать заявку»), живут в localStorage (partner-storage) —
 * здесь только статические примеры для проверки интерфейса.
 *
 * ПРАВИЛА: isFixture: true + label «Тестовый пример для проверки
 * интерфейса»; только непубличные scope; названия явно тестовые.
 */

import { fixtureMarker, type FixtureMarker } from "../../lib/types.ts";
import type { PartnerApplicationRecord } from "../../lib/partner-storage.ts";

const fixture = fixtureMarker();

export type PartnerApplicationFixture = PartnerApplicationRecord &
  FixtureMarker;

export const partnerApplicationFixtures: PartnerApplicationFixture[] = [
  {
    id: "fixture-app-review-01",
    targetType: "request",
    targetId: "fixture-request-published-06",
    targetTitle: "Тестовый запрос: модернизация линии сборки",
    customerOrganization: "Тестовая организация-заказчик",
    status: "under_review",
    note: "",
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-03T12:00:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-app-clarification-02",
    targetType: "request",
    targetId: "fixture-request-approved-04",
    targetTitle: "Тестовый запрос: цифровые сервисы для логистики",
    customerOrganization: "Тестовая организация-заказчик",
    status: "clarification",
    note: "Центр запросил подтверждение готовности площадки для опытной эксплуатации.",
    createdAt: "2026-07-30T09:00:00.000Z",
    updatedAt: "2026-08-04T09:15:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-app-approved-03",
    targetType: "pilot",
    targetId: "fixture-pilot-active-01",
    targetTitle: "Тестовый пилот: опытная эксплуатация на площадке заказчика",
    customerOrganization: "Тестовая организация-заказчик",
    status: "approved",
    note: "",
    createdAt: "2026-07-20T11:00:00.000Z",
    updatedAt: "2026-07-25T14:30:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-app-rejected-04",
    targetType: "request",
    targetId: "fixture-request-clarification-03",
    targetTitle: "Тестовый запрос: энергосберегающее оборудование",
    customerOrganization: "Тестовая организация-заказчик",
    status: "rejected",
    note: "Не хватает подтверждённого УГТ 5 и опыта внедрения в энергетике. Доукомплектуйте досье и подайте заявку повторно.",
    createdAt: "2026-07-18T08:00:00.000Z",
    updatedAt: "2026-07-28T11:00:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-app-active-05",
    targetType: "pilot",
    targetId: "fixture-pilot-blocked-02",
    targetTitle: "Тестовый пилот: интеграция датчиков контроля",
    customerOrganization: "Тестовая организация-заказчик",
    status: "active",
    note: "",
    createdAt: "2026-06-05T10:00:00.000Z",
    updatedAt: "2026-07-10T16:00:00.000Z",
    ...fixture,
  },
];
