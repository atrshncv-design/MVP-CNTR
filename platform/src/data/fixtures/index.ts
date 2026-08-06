/**
 * T-004. Каталог контролируемых UI-фикстур.
 *
 * Все записи помечены isFixture: true + label «Тестовый пример для проверки
 * интерфейса» и доступны ТОЛЬКО в авторизованных кабинетах (workspace ролей,
 * операционные очереди, dossier/запросы в scope ≠ public).
 *
 * Публичные методы адаптера (listResearch, listTechnologies,
 * listCustomerRequests, listOrganizations, getHomeSummary, getResearch,
 * getTechnology/getCustomerRequest в scope "public") фикстуры НЕ возвращают.
 */

import { fixtureMarker, type NotificationEvent } from "../../lib/types.ts";
import { technologyDossierFixtures, technologySummaryFixtures } from "./technologies.ts";
import { customerRequestFixtures, customerRequestSummaryFixtures } from "./requests.ts";
import { pilotFixtures } from "./pilots.ts";
import { operationalTaskFixtures } from "./operations.ts";

export {
  technologyDossierFixtures,
  technologySummaryFixtures,
  technologyDossiersById,
} from "./technologies.ts";
export {
  customerRequestFixtures,
  customerRequestSummaryFixtures,
  customerRequestsById,
} from "./requests.ts";
export { pilotFixtures, pilotsById } from "./pilots.ts";
export {
  operationalTaskFixtures,
  operationalTasksById,
} from "./operations.ts";

const fixture = fixtureMarker();

/** Уведомления-фикстуры для кабинетов (STATES.md §5). */
export const notificationFixtures: NotificationEvent[] = [
  {
    id: "fixture-notification-01",
    objectType: "technology",
    objectId: "fixture-tech-clarification-03",
    event: "Запрошены уточнения по технологии",
    urgency: "high",
    requiredAction: "Дополнить свидетельства",
    deadline: "2026-08-15",
    read: false,
    destination: "inbox",
    createdAt: "2026-08-05T09:00:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-notification-02",
    objectType: "request",
    objectId: "fixture-request-approved-04",
    event: "Запрос одобрен",
    urgency: "medium",
    requiredAction: null,
    deadline: null,
    read: true,
    destination: "inbox",
    createdAt: "2026-08-04T12:00:00.000Z",
    ...fixture,
  },
  {
    id: "fixture-notification-03",
    objectType: "pilot",
    objectId: "fixture-pilot-blocked-02",
    event: "Пилот заблокирован",
    urgency: "medium",
    requiredAction: "Уточнить статус у партнёра",
    deadline: null,
    read: false,
    destination: "inbox",
    createdAt: "2026-08-03T10:30:00.000Z",
    ...fixture,
  },
];

/** Полный набор фикстур для адаптера (mock-кабинеты). */
export const fixtureCatalog = {
  technologies: technologySummaryFixtures,
  technologyDossiers: technologyDossierFixtures,
  customerRequests: customerRequestSummaryFixtures,
  customerRequestFull: customerRequestFixtures,
  pilots: pilotFixtures,
  operationalTasks: operationalTaskFixtures,
  notifications: notificationFixtures,
} as const;

export type FixtureCatalog = typeof fixtureCatalog;
