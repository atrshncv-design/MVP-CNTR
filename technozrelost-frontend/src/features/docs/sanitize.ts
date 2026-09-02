/**
 * Обезличивание для узкого ИИ-консультанта по документам (тикет 06, G29, G57).
 * Почему отдельный модуль: LLM видит только уровень УГТ + коды требований
 * без ПДн (email/ФИО/организации/бюджета до решения ЦНТР). Контур kaba.
 * Все запросы POST /chat/kaba или POST /rag/search проходят через sanitize,
 * логи обезличивания — audit.
 */

import type { StageRequirementOut } from "@/lib/api-client";

/** Контур обезличивания — kaba (ГОСТ/методология). */
export const CONTOUR_KABA = "kaba" as const;

/** Разрешённые поля для LLM узкого консультанта (обезличено, без ПДн). */
export const ALLOWED_DOCS_FIELDS = ["level", "requirement_codes", "question"] as const;

export type AllowedDocsField = (typeof ALLOWED_DOCS_FIELDS)[number];

/** Запрещённые ключи ПДн — если они попадут в raw, отбрасываем. */
const FORBIDDEN_KEYS = new Set([
  "email",
  "fio",
  "full_name",
  "user.email",
  "user_name",
  "organization",
  "org_name",
  "ogrn",
  "inn",
  "phone",
  "budget",
  "created_by",
  "user_id",
  "personal",
  "project_name",
  "projectName",
]);

/** Ключевые слова, указывающие что вопрос про документы/шаблоны/ГОСТ/УГТ */
const DOCS_KEYWORDS = [
  "документ",
  "шаблон",
  "гост",
  "угт",
  "требование",
  "чек-лист",
  "чеклист",
  "переход",
  "стадия",
  "акт",
  "отчет",
  "отчёт",
  "протокол",
  "пми",
  "ту",
  "форма",
  "заполн",
  "скачать",
];

export interface DocsConsultPayload {
  level: number;
  requirement_codes: string[];
  question: string;
}

/**
 * Проверка что вопрос относится к документам УГТ.
 * Если нет — консультант отвечает «Я консультирую только по документам УГТ»
 * без обращения к LLM (G29).
 */
export function isDocsQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return DOCS_KEYWORDS.some((kw) => q.includes(kw));
}

/**
 * Санитайзер: оставляет только level + requirement_codes + question (обезличено).
 * Почему здесь: фронт отвечает за обезличивание перед POST /chat/kaba или /rag/search.
 */
export function sanitizeDocConsultInput(raw: Record<string, unknown>): DocsConsultPayload {
  const levelRaw = raw["level"];
  const level = typeof levelRaw === "number" ? levelRaw : Number(levelRaw) || 1;
  const clamped = Math.max(1, Math.min(9, Math.round(level)));

  const codesRaw = raw["requirement_codes"];
  const requirement_codes: string[] = Array.isArray(codesRaw)
    ? (codesRaw.filter((c) => typeof c === "string" && c.trim()) as string[]).slice(0, 20)
    : typeof codesRaw === "string" && codesRaw.trim()
      ? [codesRaw.trim()]
      : [];

  const question = typeof raw["question"] === "string" ? raw["question"].trim().slice(0, 2000) : "";
  // Логи обезличивания: контур kaba + поля + отброшенные ПДн
  const dropped = Object.keys(raw).filter((k) => !ALLOWED_DOCS_FIELDS.includes(k as AllowedDocsField));
  const piiDropped = dropped.filter(
    (k) =>
      FORBIDDEN_KEYS.has(k) ||
      k.toLowerCase().includes("email") ||
      k.toLowerCase().includes("budget") ||
      k.toLowerCase().includes("fio"),
  );
  if (dropped.length || piiDropped.length) {
    console.debug("[docs-consult] обезличивание contour=kaba", {
      contour: CONTOUR_KABA,
      kept: ALLOWED_DOCS_FIELDS,
      dropped,
      piiStripped: piiDropped,
      codesCount: requirement_codes.length,
    });
  } else {
    console.debug("[docs-consult] обезличивание contour=kaba — чистый payload", {
      contour: CONTOUR_KABA,
      level: clamped,
      codesCount: requirement_codes.length,
      questionLen: question.length,
    });
  }

  return {
    level: clamped,
    requirement_codes: requirement_codes.map((c) => c.trim()).filter(Boolean),
    question,
  };
}

/**
 * Построение чистого payload из уровня + требований + вопроса.
 * Берёт только открытые поля, без ПДн пользователя/организации/бюджета.
 */
export function sanitizeFromRequirements(
  level: number,
  requirements: Array<Pick<StageRequirementOut, "title" | "id">>,
  question: string,
): DocsConsultPayload {
  const raw: Record<string, unknown> = {
    level,
    requirement_codes: requirements.map((r) => r.title).filter(Boolean),
    question,
    // Намеренно НЕ берём: project.name с ПДн, organization, budget, email
  };
  return sanitizeDocConsultInput(raw);
}

/**
 * Проверка что payload не содержит ПДн (для тестов/снапшота).
 * Возвращает null если чисто, иначе описание найденных ПДн-полей.
 */
export function assertNoPii(payload: Record<string, unknown>): string | null {
  const forbiddenFound: string[] = [];
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_DOCS_FIELDS.includes(key as AllowedDocsField)) {
      forbiddenFound.push(key);
    }
    if (FORBIDDEN_KEYS.has(key)) forbiddenFound.push(`${key} (forbidden)`);
  }
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" && v.includes("@") && v.includes(".")) {
      if (k.toLowerCase().includes("mail") || v.match(/@/)) {
        forbiddenFound.push(`${k}:email-like value`);
      }
    }
  }
  if (forbiddenFound.length) return `PII leak: ${forbiddenFound.join(", ")}`;
  return null;
}

/** Ответ-заглушка для общих вопросов вне тематики документов. */
export const DOCS_ONLY_REPLY = "Я консультирую только по документам УГТ";
