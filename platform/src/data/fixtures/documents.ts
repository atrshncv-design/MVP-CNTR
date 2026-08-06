/**
 * T-012. Документы организации (контролируемые UI-фикстуры).
 *
 * Кабинетный workspace /app/documents. Реальных документов организации
 * в P0 нет — показываются помеченные тестовые примеры (isFixture + бейдж)
 * со статусами по STATES.md §1. «Принято» — только после завершения
 * валидации (STATES.md §6): фикстуры со статусом approved имитируют уже
 * проверенные документы, under_review — на проверке Центра.
 */

import {
  fixtureMarker,
  type TechnologyDocument,
} from "../../lib/types.ts";

const fixture = fixtureMarker();

/** Документы организации-фикстуры для кабинета (T-012). */
export const organizationDocumentFixtures: TechnologyDocument[] = [
  {
    id: "fixture-doc-org-card",
    title: "Карточка организации и платёжные реквизиты",
    kind: "карточка",
    status: "approved",
    ...fixture,
  },
  {
    id: "fixture-doc-egrul",
    title: "Выписка из ЕГРЮЛ",
    kind: "выписка",
    status: "under_review",
    ...fixture,
  },
  {
    id: "fixture-doc-contract",
    title: "Договор с Центром технологического развития",
    kind: "договор",
    status: "draft",
    ...fixture,
  },
  {
    id: "fixture-doc-certificate",
    title: "Свидетельство о постановке на учёт",
    kind: "свидетельство",
    status: "rejected",
    ...fixture,
  },
];
