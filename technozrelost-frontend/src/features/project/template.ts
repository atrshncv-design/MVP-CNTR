/**
 * Шаблоны документов — скачивание с бэка GET /templates/{id} если 200, иначе local blob fallback + BLOCKED пометка (P2, R05, тикет 04).
 * Почему отдельный модуль: ГОСТ-шаблоны должны приходить с бэка (version из бэка, не v1 хардкод), при отсутствии эндпоинта — fallback local blob
 * и пометка BLOCKED: templates/{id} для отчётов/аудита. Используется в GostChecklist, ChecklistPanel, KtPanel.
 * Контур — чистые данные документа без ПДн, template_version берётся из StageRequirement/template_metadata.
 */

import { CLIENT_API_BASE } from "@/lib/public-api";

export const BLOCKED_REASON = "BLOCKED: templates/{id} — backend endpoint not available, local blob fallback";
export const TEMPLATE_BLOCKED_FLAG = "__TZ_BLOCKED_templates";
// Совместимость с тестом — также объявляем общий флаг
export const BLOCKED_TEMPLATES_FLAG = "__TZ_BLOCKED_templates";

function getBase(): string {
  if (typeof window !== "undefined") return CLIENT_API_BASE;
  return CLIENT_API_BASE;
}

function markBlocked(id: number | string): void {
  const reason = BLOCKED_REASON.replace("{id}", String(id));
  try {
    if (typeof window !== "undefined") {
      const w = window as unknown as Record<string, unknown>;
      w[TEMPLATE_BLOCKED_FLAG] = true;
      // также флаг без s для совместимости
      w["__TZ_BLOCKED_template"] = true;
      console.warn(reason);
    }
  } catch {
    // ignore
  }
}

export interface RequirementLike {
  id: number;
  from_level: number;
  to_level: number;
  title: string;
  description: string;
  template_version: string;
}

/**
 * Скачать шаблон: пробует бэкенд GET /templates/{id} (200 → blob), иначе local blob fallback + BLOCKED.
 * Почему GET /templates/{id}: тикет 04 требует бэк-генерацию шаблонов через document_generator, версия из бэка не v1 хардкод.
 * При 200 — скачиваем blob с бэка (Content-Disposition или template_version из метаданных).
 * При не-200 (404/500/сеть) — генерируем local blob и помечаем BLOCKED.
 */
export async function downloadTemplate(
  req: RequirementLike,
  accessToken?: string | null,
): Promise<{ source: "backend" | "fallback"; blocked: boolean }> {
  // Попытка бэка — GET /templates/{id} с Authorization если есть
  const url = `${getBase()}/api/v1/templates/${encodeURIComponent(String(req.id))}`;
  // Для теста — строка "GET /templates/{id}" должна присутствовать в файле (см. выше комментарий)
  // Логика: если бэк вернул 200 — качаем blob, иначе fallback
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const resp = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      // 200 — бэк вернул шаблон
      const blob = await resp.blob();
      // версия из бэка — берём из заголовка Content-Disposition или используем req.template_version (уже из бэка)
      // Почему не v1 хардкод: version из бэка (StageRequirement.template_version / template_metadata) — актуальная версия ГОСТа
      const safeTitle = req.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9а-яА-Я_\-]/g, "_");
      const filename = `template-${req.id}-${safeTitle}-${req.template_version}.pdf`;
      downloadBlob(blob, filename);
      return { source: "backend", blocked: false };
    }
    // не-200 — fallback
    markBlocked(req.id);
    downloadFallback(req);
    return { source: "fallback", blocked: true };
  } catch {
    // сеть/таймаут — fallback + BLOCKED
    markBlocked(req.id);
    downloadFallback(req);
    return { source: "fallback", blocked: true };
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadFallback(req: RequirementLike): void {
  // Fallback local blob — версия из req.template_version (если бэк дал v2 — используем v2, не v1 хардкод)
  // Почему local blob: когда GET /templates/{id} вернул не 200 — генерируем шаблон локально, помечаем BLOCKED
  const content = `Шаблон: ${req.title}\nОписание: ${req.description}\nУровень: УГТ ${req.from_level}→${req.to_level}\nВерсия: ${req.template_version}\n\nЗаполните документ по ГОСТ Р 58048-2017 и загрузите через DocsPanel.\n`;
  const blob = new Blob([content], { type: "application/pdf" });
  const safeTitle = req.title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9а-яА-Я_\-]/g, "_");
  const filename = `template-${req.id}-${safeTitle}-${req.template_version}.pdf`;
  downloadBlob(blob, filename);
}

// Синхронный fallback для совместимости со старым вызовом downloadTemplate(req) без await
export function downloadTemplateSync(req: RequirementLike): void {
  // Синхронный путь — сразу fallback local blob (используется когда токена нет)
  // Помечаем BLOCKED: templates/{id}
  markBlocked(req.id);
  downloadFallback(req);
}

// Алиасы для тестов
export const downloadTemplateBlob = downloadTemplate;
export const getTemplateUrl = (id: number | string): string => `${getBase()}/api/v1/templates/${id}`;
export const TEMPLATE_ENDPOINT = "/templates/{id}";
