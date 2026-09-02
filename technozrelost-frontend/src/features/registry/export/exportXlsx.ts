/**
 * Client-side XLSX экспорт реестров (тикет 01, R01 — XLSX админу).
 * Почему client-side exceljs: без бэк-изменений, фильтры из URL уже применены
 * к отображаемым строкам (те же строки что на экране, limit 20 или все отфильтрованные).
 * Используется exceljs — пакет ставится через `npm i exceljs@4.4.0` (иначе BLOCKED).
 * Экранирование =+-@ через escapeExcelValue, заголовки + строки текущей выборки.
 */

import { escapeRow } from "./escape";
// escapeExcelValue используется внутри escapeRow — защита от =+-@ (см. escape.ts)
import type { NioktrCardOut, OrganizationOut, RegistryProjectOut } from "@/lib/types";

// Заголовки для проектов — порядок фиксирован для теста «содержит заголовки»
export const PROJECT_HEADERS = [
  "ID",
  "Название",
  "Описание",
  "Теги",
  "УГТ текущий",
  "УГТ целевой",
  "Бюджет, ₽",
  "Организация",
  "Статус",
  "Создан",
  "Обновлён",
] as const;

export const ORG_HEADERS = [
  "ID",
  "Название",
  "Краткое название",
  "ОГРН",
  "Тип",
  "Регион",
  "Проектов",
  "Компетенции",
] as const;

export const NIOKTR_HEADERS = [
  "ID",
  "Рег. номер",
  "Название",
  "Аннотация",
  "Ключевые слова",
  "Типы НИОКТР",
  "Исполнитель",
  "Заказчик",
  "Дата создания",
  "ИИ-направление",
] as const;

type BuildOptions = { sheetName?: string };

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

// Маркеры для статуса — человекочитаемые лейблы вместо slug
function formatStatus(status: unknown): string {
  if (!status || typeof status !== "string") return "—";
  // Минимальный маппинг без импорта lib/status, чтобы не тянуть лишнее в client-бандл
  const map: Record<string, string> = {
    draft: "Черновик",
    pending: "На рассмотрении",
    active: "Активен",
    archived: "Архив",
    completed: "Завершён",
    rejected: "Отклонён",
    verified: "Верифицирован",
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
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Технозрелость";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts?.sheetName ?? "Реестр проектов");
  applyColumnWidths(ws, PROJECT_HEADERS, [10, 36, 48, 28, 12, 12, 18, 24, 14, 16, 16]);
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
      formatStatus(r.status),
      r.created_at ?? "—",
      r.updated_at ?? "—",
    ];
    ws.addRow(escapeRow(values));
  }

  // Автофильтр и заморозка заголовка — удобство для админа
  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: PROJECT_HEADERS.length },
    };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return wb;
}

export async function buildOrganizationWorkbook(
  rows: OrganizationOut[],
  opts?: BuildOptions,
): Promise<import("exceljs").Workbook> {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Технозрелость";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts?.sheetName ?? "Организации");
  applyColumnWidths(ws, ORG_HEADERS, [10, 34, 20, 18, 14, 14, 10, 30]);
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
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ORG_HEADERS.length } };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return wb;
}

export async function buildNioktrWorkbook(
  rows: NioktrCardOut[],
  opts?: BuildOptions,
): Promise<import("exceljs").Workbook> {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Технозрелость";
  wb.created = new Date();
  const ws = wb.addWorksheet(opts?.sheetName ?? "НИОКТР");
  applyColumnWidths(ws, NIOKTR_HEADERS, [10, 18, 36, 40, 24, 18, 20, 20, 14, 12]);
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
      r.is_ai_area ? "Да" : "Нет",
    ];
    ws.addRow(escapeRow(values));
  }

  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: NIOKTR_HEADERS.length } };
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
  opts?: { filename?: string; sheetName?: string },
): Promise<void> {
  const wb = await buildProjectWorkbook(rows, { sheetName: opts?.sheetName });
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
  opts?: { filename?: string; sheetName?: string },
): Promise<void> {
  const wb = await buildOrganizationWorkbook(rows, { sheetName: opts?.sheetName });
  const filename = opts?.filename ?? `registry-organizations-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * Экспорт НИОКТР — используется в /dashboard/nioktr.
 */
export async function exportNioktrXlsx(
  rows: NioktrCardOut[],
  opts?: { filename?: string; sheetName?: string },
): Promise<void> {
  const wb = await buildNioktrWorkbook(rows, { sheetName: opts?.sheetName });
  const filename = opts?.filename ?? `registry-nioktr-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}

/**
 * Универсальный экспорт — дженерик для ExportButton, принимает любые строки реестра,
 * сам определяет тип и скачивает соответствующий XLSX с текущими фильтрами.
 */
export async function exportGenericXlsx(
  rows: unknown[],
  opts?: { filename?: string; sheetName?: string; registryKey?: string },
): Promise<void> {
  const wb = await buildWorkbook(rows as unknown[], { sheetName: opts?.sheetName });
  const key = opts?.registryKey ?? "registry";
  const filename = opts?.filename ?? `${key}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}
