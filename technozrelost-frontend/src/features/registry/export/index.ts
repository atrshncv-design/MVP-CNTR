/**
 * Публичный шов модуля registry/export (interfaces.md).
 * Владеет XLSX экспортом, выставляет exportXlsx, прячет exceljs и escape.
 * Почему barrel: единый импорт из @/features/registry/export.
 */

export { escapeExcelValue, escapeRow } from "./escape";
export {
  PROJECT_HEADERS,
  ORG_HEADERS,
  NIOKTR_HEADERS,
  isNioktrRow,
  isOrganizationRow,
  buildProjectWorkbook,
  buildOrganizationWorkbook,
  buildNioktrWorkbook,
  buildWorkbook,
  exportRegistryXlsx,
  exportXlsx,
  exportOrganizationsXlsx,
  exportNioktrXlsx,
  exportGenericXlsx,
} from "./exportXlsx";
export { ExportButton } from "./ExportButton";
export { default } from "./ExportButton";
