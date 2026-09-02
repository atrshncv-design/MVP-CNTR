/**
 * Экранирование формул-инъекций для XLSX (тикет 01, R01 — экспорт админу).
 * Почему отдельный модуль: защита от CSV injection по OWASP — Excel
 * исполняет ячейки, начинающиеся с =+-@, как формулы. Префикс апострофа
 * заставляет Excel трактовать значение как текст без исполнения.
 * Правило escape — только строки, проверка первого символа после trimStart,
 * чтобы пробел не обходил защиту, но оригинал сохраняется. escape =+-@
 */

export function escapeExcelValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.length === 0) return value;
  // Проверка после удаления лидирующих пробелов/табов — защита от " =2+2"
  const trimmed = value.trimStart();
  if (trimmed.length === 0) return value;
  if (/^[=+\-@]/.test(trimmed)) {
    // Префикс "'" — Excel покажет значение как текст, формула не исполнится
    return `'${value}`;
  }
  return value;
}

/**
 * Экранирование всего ряда — применяется к каждой ячейке перед addRow.
 * Почему массив: Workbook.addRow принимает массив значений, нужно защитить каждую строку.
 */
export function escapeRow(values: unknown[]): unknown[] {
  return values.map(escapeExcelValue);
}
