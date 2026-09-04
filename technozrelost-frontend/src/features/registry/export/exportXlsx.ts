/**
 * Client-side XLSX экспорт реестров (тикет 01, R01 — XLSX админу).
 * Почему client-side exceljs: без бэк-изменений, фильтры из URL уже применены
 * к отображаемым строкам (те же строки что на экране, limit 20 или все отфильтрованные).
 * Используется exceljs — пакет ставится через `npm i exceljs@4.4.0` (иначе BLOCKED).
 * Экранирование =+-@ через escapeExcelValue, заголовки + строки текущей выборки.
 */

import { escapeRow } from "./escape.ts";
// escapeExcelValue используется внутри escapeRow — защита от =+-@ (см. escape.ts)
import type { NioktrCardOut, OrganizationOut, RegistryProjectOut } from "@/lib/types";
import type { TranslateFn } from "@/lib/types";
import { registryTranslator } from "../i18n.ts";

/**
 * Заголовки выгрузки — только через перевод (R03.1): каждый столбец резолвится
 * из неймспейса registry под локаль вызова. Порядок колонок фиксирован.
 * Почему функции, а не константы: заголовок зависит от локали.
 */
export function getProjectHeaders(t: TranslateFn): string[] {
  return [
    t("exportId"),
    t("exportName"),
    t("exportDescription"),
    t("exportTags"),
    t("exportUgtCurrent"),
    t("exportUgtTarget"),
    t("exportBudget"),
    t("exportOrganization"),
    t("exportStatus"),
    t("exportCreated"),
    t("exportUpdated"),
  ];
}

export function getOrganizationHeaders(t: TranslateFn): string[] {
  return [
    t("exportId"),
    t("exportName"),
    t("exportShortName"),
    t("exportOgrn"),
    t("exportOrgType"),
    t("exportRegion"),
    t("exportProjectsCount"),
    t("exportCompetencies"),
  ];
}

export function getNioktrHeaders(t: TranslateFn): string[] {
  return [
    t("exportId"),
    t("exportRegNumber"),
    t("exportName"),
    t("exportAnnotation"),
    t("exportKeywords"),
    t("exportNioktrTypes"),
    t("exportExecutor"),
    t("exportCustomer"),
    t("exportCreatedDate"),
    t("exportAiArea"),
  ];
}

type BuildOptions = { sheetName?: string; t?: TranslateFn };

/**
 * Проверка типа ряда — определяет, какой воркбук строить.
 * Почему эвристика: реестры проектов/организаций/НИОКТР имеют пересекающиеся поля,
 * но ключевые маркеры уникальны (registration_number, ogrn/org_type).
 */
export function isNioktrRow(row: unknown): row is NioktrCardOut {
  return !!row && typeof row === "object" && "registration_number" in (row as Record<string, unknown>);
}

export function isOrganizationRow(row: unknown): row is OrganizationOut {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return "ogrn" in r || "org_type" in r;
}

// Вспомогательная стилизация заголовка — почему вынесена: единообразие всех реестров
async function getExcelJS() {
  // Динамический импорт — только в браузере, чтобы не тянуть Node-полифилы в SSR (тикет 01 — без бэк-изменений)
  const mod = await import("exceljs");
  // exceljs экспортирует default с Workbook; fallback на именованный импорт для совместимости
  return (mod.default ?? mod) as unknown as typeof import("exceljs");
}

function styleHeaderRow(row: import("exceljs").Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 22;
  row.commit();
}

function applyColumnWidths(
  ws: import("exceljs").Worksheet,
  headers: readonly string[],
  widths: number[],
): void {
  ws.columns = headers.map((header, idx) => ({
    header,
    key: `col${idx}`,
    width: widths[idx] ?? 16,
  }));
}

// Статусы в файле — человекочитаемые лейблы из словаря вместо slug.
// Неизвестный slug отдаём как есть (данные бэкенда, не словарь).
function formatStatusT(t: TranslateFn, status: unknown): string {
  if (!status || typeof status !== "string") return "—";
  const map: Record<string, string> = {
    draft: t("exportStatusDraft"),
    pending: t("exportStatusPending"),
    active: t("exportStatusActive"),
    archived: t("exportStatusArchived"),
    completed: t("exportStatusCompleted"),
    rejected: t("exportStatusRejected"),
    verified: t("exportStatusVerified"),
  };
  return map[status] ?? status;
}

/**
 * Построение воркбука проектов — чистая функция для тестов (без скачивания).
 * Возвращает Workbook, чтобы тест мог проверить заголовки + строки + escape =+-@.
 */
export async function buildProjectWorkbook(
  rows: RegistryProjectOut[],
  opts?: BuildOptions,
): Promise<import("exceljs").Workbook> {
  const tr = opts?.t ?? registryTranslator();
  const headers = getProjectHeaders(tr);
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Технозрелость";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts?.sheetName ?? tr("exportSheetProjects"));
  applyColumnWidths(ws, headers, [10, 36, 48, 28, 12, 12, 18, 24, 14, 16, 16]);
  styleHeaderRow(ws.getRow(1));

  for (const r of rows) {
    const tags = r.tags?.length ? r.tags.join(", ") : (r.category ?? "—");
    const values: unknown[] = [
      r.id,
      r.name ?? "—",
      r.description ?? "—",
      tags,
      r.current_level ?? "—",
      r.target_level ?? "—",
      r.budget ?? "—",
      r.organization ?? "—",
      formatStatusT(tr, r.status),
      r.created_at ?? "—",
      r.updated_at ?? "—",
    ];
    ws.addRow(escapeRow(values));
  }

  // Автофильтр и заморозка заголовка — удобство для админа
  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return wb;
}

export async function buildOrganizationWorkbook(
  rows: OrganizationOut[],
  opts?: BuildOptions,
): Promise<import("exceljs").Workbook> {
  const tr = opts?.t ?? registryTranslator();
  const headers = getOrganizationHeaders(tr);
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Технозрелость";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts?.sheetName ?? tr("exportSheetOrganizations"));
  applyColumnWidths(ws, headers, [10, 34, 20, 18, 14, 14, 10, 30]);
  styleHeaderRow(ws.getRow(1));

  for (const r of rows) {
    const competencies = r.competencies?.length ? r.competencies.join(", ") : "—";
    const values: unknown[] = [
      r.id,
      r.name ?? "—",
      r.short_name ?? "—",
      r.ogrn ?? "—",
      r.org_type ?? "—",
      r.region ?? "—",
      r.projects_count ?? 0,
      competencies,
    ];
    ws.addRow(escapeRow(values));
  }

  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return wb;
}

export async function buildNioktrWorkbook(
  rows: NioktrCardOut[],
  opts?: BuildOptions,
): Promise<import("exceljs").Workbook> {
  const tr = opts?.t ?? registryTranslator();
  const headers = getNioktrHeaders(tr);
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Технозрелость";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts?.sheetName ?? tr("exportSheetNioktr"));
  applyColumnWidths(ws, headers, [10, 18, 36, 40, 24, 18, 20, 20, 14, 12]);
  styleHeaderRow(ws.getRow(1));

  for (const r of rows) {
    const keywords = r.keywords?.length ? r.keywords.join(", ") : "—";
    const types = r.nioktr_types?.length ? r.nioktr_types.join(", ") : "—";
    const values: unknown[] = [
      r.id,
      r.registration_number ?? "—",
      r.name ?? "—",
      r.annotation ?? "—",
      keywords,
      types,
      r.executor_name ?? "—",
      r.customer_name ?? "—",
      r.created_date ?? "—",
      r.is_ai_area ? tr("exportYes") : tr("exportNo"),
    ];
    ws.addRow(escapeRow(values));
  }

  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return wb;
}

/**
 * Универсальный билдер — выбирает тип по первому ряду (для ExportButton generic).
 */
export async function buildWorkbook(
  rows: unknown[],
  opts?: BuildOptions,
): Promise<import("exceljs").Workbook> {
  if (rows.length === 0) {
    // Пустой реестр — отдаём проектный заголовок (содержит заголовки даже без строк)
    return buildProjectWorkbook([], opts);
  }
  const first = rows[0];
  if (isNioktrRow(first)) return buildNioktrWorkbook(rows as NioktrCardOut[], opts);
  if (isOrganizationRow(first)) return buildOrganizationWorkbook(rows as OrganizationOut[], opts);
  return buildProjectWorkbook(rows as RegistryProjectOut[], opts);
}

// Скачивание — отделено от построения для тестируемости
async function downloadWorkbook(
  wb: import("exceljs").Workbook,
  filename: string,
): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Отложенная очистка — чтобы браузер успел начать скачивание
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Экспорт проектов — основной шов registry/export (interfaces.md).
 * Принимает те же строки что на экране (уже отфильтрованные в displayItems),
 * поэтому фильтры из URL автоматически применяются — не требует повторного запроса.
 * Экранирование =+-@ выполняется для каждой ячейки.
 */
export async function exportRegistryXlsx(
  rows: RegistryProjectOut[],
  opts?: { filename?: string; sheetName?: string; t?: TranslateFn },
): Promise<void> {
  const wb = await buildProjectWorkbook(rows, { sheetName: opts?.sheetName, t: opts?.t });
  const filename = opts?.filename ?? `registry-projects-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * Алиас-шва из interfaces.md — модуль выставляет exportXlsx, прячет exceljs.
 */
export const exportXlsx = exportRegistryXlsx;

/**
 * Экспорт организаций — используется в /dashboard/organizations.
 */
export async function exportOrganizationsXlsx(
  rows: OrganizationOut[],
  opts?: { filename?: string; sheetName?: string; t?: TranslateFn },
): Promise<void> {
  const wb = await buildOrganizationWorkbook(rows, { sheetName: opts?.sheetName, t: opts?.t });
  const filename = opts?.filename ?? `registry-organizations-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * Экспорт НИОКТР — используется в /dashboard/nioktr.
 */
export async function exportNioktrXlsx(
  rows: NioktrCardOut[],
  opts?: { filename?: string; sheetName?: string; t?: TranslateFn },
): Promise<void> {
  const wb = await buildNioktrWorkbook(rows, { sheetName: opts?.sheetName, t: opts?.t });
  const filename = opts?.filename ?? `registry-nioktr-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * Универсальный экспорт — дженерик для ExportButton, принимает любые строки реестра,
 * сам определяет тип и скачивает соответствующий XLSX с текущими фильтрами.
 */
export async function exportGenericXlsx(
  rows: unknown[],
  opts?: { filename?: string; sheetName?: string; registryKey?: string; t?: TranslateFn },
): Promise<void> {
  const wb = await buildWorkbook(rows as unknown[], { sheetName: opts?.sheetName, t: opts?.t });
  const key = opts?.registryKey ?? "registry";
  const filename = opts?.filename ?? `${key}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}
