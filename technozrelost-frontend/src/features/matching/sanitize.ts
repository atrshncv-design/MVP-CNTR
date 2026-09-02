/**
 * Обезличивание для мэтчинга (тикет 05, G57, R32, G44).
 * Почему отдельный модуль: LLM видит только чистые поля title/annotation/
 * sector/ugt/region/competencies, без ПДн. Контур tuno — технологический
 * контур без персональных данных. Любой запрос к POST /match проходит
 * через sanitize, логи обезличивания — audit.
 */

import type { MatchingIn } from "@/lib/types";
import type { ProjectCardOut } from "@/lib/types";

/**
 * Контур обезличивания — tuno (технологический-нейтральный).
 * Почему tuno: LLM-ранкер работает только в контуре без ПДн,
 * бюджет/ФИО/email/организация с ОГРН не покидают платформу.
 */
export const CONTOUR_TUNO = "tuno" as const;

/**
 * Разрешённые поля для LLM (чистые, без ПДн).
 * Запрещены: email, full_name, fio, organization с контактами,
 * budget, ogrn, phone, inn и любые персональные атрибуты.
 */
export const ALLOWED_MATCH_FIELDS = [
  "title",
  "annotation",
  "sector",
  "ugt_level",
  "region",
  "competencies",
] as const;

export type AllowedMatchField = (typeof ALLOWED_MATCH_FIELDS)[number];

/**
 * Запрещённые ключи ПДн — если они попадут в raw, отбрасываем и логируем.
 */
const FORBIDDEN_KEYS = new Set([
  "email",
  "fio",
  "full_name",
  "user.email",
  "organization",
  "org_name",
  "ogrn",
  "inn",
  "phone",
  "budget",
  "created_by",
  "user_id",
  "personal",
]);

/**
 * Санитайзер: оставляет только 6 чистых полей, отбрасывает ПДн.
 * Почему здесь: фронт не изобретает скоринг, но отвечает за обезличивание
 * перед POST /match (интервью 25- «только чистые данные»).
 */
export function sanitizeMatchingInput(raw: Record<string, unknown>): MatchingIn {
  const title = typeof raw["title"] === "string" ? raw["title"].trim() : "";
  const annotation =
    typeof raw["annotation"] === "string" ? raw["annotation"].trim() : null;
  const sector =
    typeof raw["sector"] === "string" && raw["sector"].trim()
      ? raw["sector"].trim()
      : null;
  const ugt_level =
    typeof raw["ugt_level"] === "number" && raw["ugt_level"] >= 1 && raw["ugt_level"] <= 9
      ? raw["ugt_level"]
      : raw["ugt_level"] != null && String(raw["ugt_level"]).trim() !== ""
        ? Number(raw["ugt_level"])
        : null;
  const region =
    typeof raw["region"] === "string" && raw["region"].trim()
      ? raw["region"].trim()
      : null;
  const competenciesRaw = raw["competencies"];
  const competencies: string[] = Array.isArray(competenciesRaw)
    ? (competenciesRaw.filter((c) => typeof c === "string" && c.trim()) as string[]).slice(0, 5)
    : [];

  // Логи обезличивания: контур tuno + поля + отброшенные ПДн
  const dropped = Object.keys(raw).filter((k) => !ALLOWED_MATCH_FIELDS.includes(k as AllowedMatchField));
  const piiDropped = dropped.filter((k) => FORBIDDEN_KEYS.has(k) || k.toLowerCase().includes("email") || k.toLowerCase().includes("budget"));
  if (dropped.length || piiDropped.length) {
    console.debug("[matching] обезличивание contour=tuno", {
      contour: CONTOUR_TUNO,
      kept: ALLOWED_MATCH_FIELDS,
      dropped,
      piiStripped: piiDropped,
      competenciesCount: competencies.length,
    });
  } else {
    console.debug("[matching] обезличивание contour=tuno — чистый payload", {
      contour: CONTOUR_TUNO,
      titleLen: title.length,
      competenciesCount: competencies.length,
    });
  }

  return {
    title,
    annotation: annotation || null,
    sector: sector || null,
    ugt_level: ugt_level != null && !Number.isNaN(ugt_level) ? Number(ugt_level) : null,
    region: region || null,
    competencies,
  };
}

/**
 * Построение чистого payload из карточки проекта (выбор из GET /projects).
 * Берёт только открытые поля проекта, без ПДн пользователя/организации/бюджета.
 */
export function sanitizeFromProject(
  project: ProjectCardOut,
  overrides: Partial<Pick<MatchingIn, "sector" | "ugt_level" | "region" | "competencies">> = {},
): MatchingIn {
  const raw: Record<string, unknown> = {
    title: project.name ?? "",
    annotation: project.description ?? null,
    sector: overrides.sector ?? project.category ?? project.tags?.[0] ?? null,
    ugt_level: overrides.ugt_level ?? project.current_level ?? null,
    region: overrides.region ?? null,
    competencies: overrides.competencies ?? project.tags ?? [],
    // Намеренно НЕ берём: organization, budget, created_by, email и т.п.
  };
  return sanitizeMatchingInput(raw);
}

/**
 * Проверка что payload не содержит ПДн (для тестов/снапшота).
 * Возвращает null если чисто, иначе описание найденных ПДн-полей.
 */
export function assertNoPii(payload: Record<string, unknown>): string | null {
  const forbiddenFound: string[] = [];
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_MATCH_FIELDS.includes(key as AllowedMatchField)) {
      forbiddenFound.push(key);
    }
    if (FORBIDDEN_KEYS.has(key)) forbiddenFound.push(`${key} (forbidden)`);
  }
  // Поиск значений с email-подобным содержанием
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" && v.includes("@") && v.includes(".")) {
      // эвристика email в значении
      if (k.toLowerCase().includes("mail") || v.match(/@/)) {
        forbiddenFound.push(`${k}:email-like value`);
      }
    }
  }
  if (forbiddenFound.length) return `PII leak: ${forbiddenFound.join(", ")}`;
  return null;
}

/**
 * Проверка достаточности данных для мэтчинга.
 * Недостаточно → подсказка «Заполните карточку проекта».
 */
export function isInsufficient(payload: MatchingIn): boolean {
  const titleOk = payload.title.trim().length >= 5;
  const hasContent = !!payload.annotation?.trim() || payload.competencies.length > 0 || !!payload.sector;
  return !titleOk || !hasContent;
}
