/**
 * T-004. Контролируемые UI-фикстуры запросов заказчиков.
 *
 * НАЗНАЧЕНИЕ: проверка сценариев статусов в кабинете заказчика
 * (STATES.md §1): draft / under_review / clarification / approved / rejected /
 * published + публикационный статус.
 *
 * ПРАВИЛА: isFixture: true + label «Тестовый пример для проверки интерфейса»;
 * только непубличные scope; названия явно тестовые (не выдуманные компании).
 */

import {
  fixtureMarker,
  type CustomerRequest,
  type CustomerRequestSummary,
} from "../../lib/types.ts";

const fixture = fixtureMarker();

export const customerRequestSummaryFixtures: CustomerRequestSummary[] = [
  {
    id: "fixture-request-draft-01",
    title: "Тестовый запрос: подбор решения для контроля качества",
    problemStatement:
      "Тестовый пример для проверки интерфейса в статусе «Черновик»: запрос создан, но не отправлен в Центр.",
    customerOrganization: "Тестовая организация-заказчик",
    industry: "Промышленность",
    status: "draft",
    publicationStatus: "draft",
    createdAt: "2026-08-01T09:00:00.000Z",
    deadline: null,
    ...fixture,
  },
  {
    id: "fixture-request-review-02",
    title: "Тестовый запрос: автоматизация учёта на производстве",
    problemStatement:
      "Тестовый пример для проверки интерфейса в статусе «На проверке»: запрос подан и обрабатывается Центром.",
    customerOrganization: "Тестовая организация-заказчик",
    industry: "Машиностроение",
    status: "under_review",
    publicationStatus: "draft",
    createdAt: "2026-08-02T10:00:00.000Z",
    deadline: null,
    ...fixture,
  },
  {
    id: "fixture-request-clarification-03",
    title: "Тестовый запрос: энергосберегающее оборудование",
    problemStatement:
      "Тестовый пример для проверки интерфейса в статусе «Нужны уточнения»: Центр запросил дополнительные детали.",
    customerOrganization: "Тестовая организация-заказчик",
    industry: "Энергетика",
    status: "clarification",
    publicationStatus: "draft",
    createdAt: "2026-08-03T11:30:00.000Z",
    deadline: null,
    ...fixture,
  },
  {
    id: "fixture-request-approved-04",
    title: "Тестовый запрос: цифровые сервисы для логистики",
    problemStatement:
      "Тестовый пример для проверки интерфейса в статусе «Одобрено»: запрос одобрен, формируется подбор исполнителей.",
    customerOrganization: "Тестовая организация-заказчик",
    industry: "Логистика",
    status: "approved",
    publicationStatus: "approval",
    createdAt: "2026-08-04T12:00:00.000Z",
    deadline: "2026-10-01",
    ...fixture,
  },
  {
    id: "fixture-request-rejected-05",
    title: "Тестовый запрос: оборудование для пищевой отрасли",
    problemStatement:
      "Тестовый пример для проверки интерфейса в статусе «Отклонено»: показана причина отказа.",
    customerOrganization: "Тестовая организация-заказчик",
    industry: "Пищевая промышленность",
    status: "rejected",
    publicationStatus: "draft",
    createdAt: "2026-07-30T08:00:00.000Z",
    deadline: null,
    ...fixture,
  },
  {
    id: "fixture-request-published-06",
    title: "Тестовый запрос: модернизация линии сборки",
    problemStatement:
      "Тестовый пример для проверки интерфейса в статусе «Опубликовано» (в публичный реестр фикстуры не попадают).",
    customerOrganization: "Тестовая организация-заказчик",
    industry: "Машиностроение",
    status: "published",
    publicationStatus: "published",
    createdAt: "2026-08-05T13:00:00.000Z",
    deadline: "2026-11-15",
    ...fixture,
  },
];

export const customerRequestFixtures: CustomerRequest[] =
  customerRequestSummaryFixtures.map(
    (s): CustomerRequest => ({
      id: s.id,
      title: s.title,
      problemStatement: s.problemStatement,
      customerOrganization: s.customerOrganization,
      industry: s.industry,
      constraints: ["Тестовое ограничение 1", "Тестовое ограничение 2"],
      desiredCapability:
        "Желаемый результат — тестовый пример для проверки интерфейса.",
      implementationContext:
        "Контекст внедрения — тестовый пример для проверки интерфейса.",
      status: s.status,
      publicationStatus: s.publicationStatus,
      createdAt: s.createdAt,
      deadline: s.deadline,
      matchedTechnologies: [],
      relatedPilot: null,
      ...fixture,
    }),
  );

export const customerRequestsById: ReadonlyMap<string, CustomerRequest> =
  new Map(customerRequestFixtures.map((r) => [r.id, r]));
