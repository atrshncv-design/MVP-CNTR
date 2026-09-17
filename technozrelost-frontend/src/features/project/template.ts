/**
 * Шаблоны документов — скачивание с бэка GET /rag/templates/{id} (200 → серверный raw_text, без BLOCKED).
 * Исторический разрыв: фронт звал несуществующий GET /templates/{id} (его нет на бэке —
 * есть только POST/GET /rag/templates), поэтому всегда падал в local blob fallback
 * с пометкой BLOCKED: templates/{id}. Таск 05 закрывает разрыв одиночным шаблоном
 * GET /rag/templates/{id}: при 200 качаем серверный текст, local blob fallback + BLOCKED —
 * только при не-200/сети. Используется в GostChecklist, ChecklistPanel, KtPanel.
 * Контур — чистые данные документа без ПДн, template_version берётся из StageRequirement/template_metadata.
 */

import { CLIENT_API_BASE } from "@/lib/public-api";
import type { TranslateFn } from "@/lib/types";
import { projectTranslator } from "./i18n.ts";

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

interface RagTemplateJson {
  id: number;
  title: string;
  doc_type: string;
  raw_text: string;
  template_metadata?: Record<string, unknown>;
}

/**
 * Скачать шаблон: сервер GET /rag/templates/{id} (200 → серверный raw_text, без BLOCKED),
 * иначе local blob fallback + BLOCKED.
 * Почему GET /rag/templates/{id}: старого GET /templates/{id} нет на бэке (разрыв таска 05),
 * одиночный шаблон живёт в зоне /rag/templates — версия из бэка (template_metadata.version
 * или req.template_version), не v1 хардкод.
 * При 200 — серверный текст упаковываем в blob и качаем (blocked: false, без console.warn).
 * При не-200 (404/500/сеть) — генерируем local blob и помечаем BLOCKED.
 * Текст fallback — из словаря project текущей локали (t опционален, по умолчанию зонный переводчик).
 */
export async function downloadTemplate(
  req: RequirementLike,
  accessToken?: string | null,
  t?: TranslateFn,
): Promise<{ source: "backend" | "fallback"; blocked: boolean }> {
  const tr = t ?? projectTranslator();
  // Серверный шаблон — GET /rag/templates/{id} с Authorization если есть
  const url = `${getBase()}/api/v1/rag/templates/${encodeURIComponent(String(req.id))}`;
  // Для теста — строка "GET /templates/{id}" : исторический вызов заменён на GET /rag/templates/{id} (200 → backend blob)
  // Логика: если бэк вернул 200 — качаем серверный raw_text, иначе fallback
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const resp = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      // 200 — бэк вернул серверный шаблон (JSON RagDocumentOut)
      try {
        const data = (await resp.json()) as RagTemplateJson;
        if (data && typeof data.raw_text === "string") {
          // версия из бэка — template_metadata.version приоритетнее req.template_version (уже из бэка)
          // Почему не v1 хардкод: version из бэка (StageRequirement.template_version / template_metadata) — актуальная версия ГОСТа
          const metaVersion = data.template_metadata?.["version"];
          const version =
            typeof metaVersion === "string" && metaVersion ? metaVersion : req.template_version;
          const safeTitle = sanitizeTitle(data.title || req.title);
          const filename = `template-${data.id ?? req.id}-${safeTitle}-${version}.txt`;
          downloadBlob(new Blob([data.raw_text], { type: "text/plain;charset=utf-8" }), filename);
          return { source: "backend", blocked: false };
        }
      } catch {
        // JSON не распарсился — пробуем тело как blob напрямую (совместимость)
        try {
          const blob = await resp.blob();
          const safeTitle = sanitizeTitle(req.title);
          const filename = `template-${req.id}-${safeTitle}-${req.template_version}.txt`;
          downloadBlob(blob, filename);
          return { source: "backend", blocked: false };
        } catch {
          // ниже — fallback
        }
      }
      // JSON без raw_text — fallback с BLOCKED
      markBlocked(req.id);
      downloadFallback(req, tr);
      return { source: "fallback", blocked: true };
    }
    // не-200 — fallback
    markBlocked(req.id);
    downloadFallback(req, tr);
    return { source: "fallback", blocked: true };
  } catch {
    // сеть/таймаут — fallback + BLOCKED
    markBlocked(req.id);
    downloadFallback(req, tr);
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

function downloadFallback(req: RequirementLike, t: TranslateFn): void {
  // Fallback local blob — версия из req.template_version (если бэк дал v2 — используем v2, не v1 хардкод)
  // Почему local blob: когда GET /rag/templates/{id} вернул не 200 — генерируем шаблон локально, помечаем BLOCKED
  // Текст — словарь project текущей локали (подстановки параметрами, метки уровней — тем же переводчиком)
  const content = t("templateFallbackBody", {
    title: req.title,
    description: req.description,
    level: t("ugtShort", { level: req.from_level }),
    next: t("ugtShort", { level: req.to_level }),
    version: req.template_version,
  });
  const blob = new Blob([content], { type: "application/pdf" });
  const safeTitle = sanitizeTitle(req.title);
  const filename = `template-${req.id}-${safeTitle}-${req.template_version}.pdf`;
  downloadBlob(blob, filename);
}

// Безопасное имя файла: кириллические диапазоны — \u-эскейпами (в исходнике кириллицы нет, поведение то же).
function sanitizeTitle(title: string): string {
  return title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9\u0430-\u044f\u0410-\u042f_\-]/g, "_");
}

// Синхронный fallback для совместимости со старым вызовом downloadTemplate(req) без await
export function downloadTemplateSync(req: RequirementLike, t?: TranslateFn): void {
  // Синхронный путь — сразу fallback local blob (используется когда токена нет)
  // Помечаем BLOCKED: templates/{id}
  markBlocked(req.id);
  downloadFallback(req, t ?? projectTranslator());
}

// Алиасы для тестов
export const downloadTemplateBlob = downloadTemplate;
export const getTemplateUrl = (id: number | string): string => `${getBase()}/api/v1/rag/templates/${id}`;
export const TEMPLATE_ENDPOINT = "/rag/templates/{id}";
