/**
 * Зонные переводчики misc (лендинг, вход, остаток фич) для мест без хука
 * useTranslations (чистые утилиты, llm-модуль, mock-данные чек-листа).
 * Построены через фабрику таска 01 (translatorFor/shimLocale из
 * src/lib/translators.ts) — своего wiring (createTranslator, импорт
 * словарей) здесь нет. Локаль — текущая (cookie NEXT_LOCALE, иначе
 * default приложения).
 */
import { shimLocale, translatorFor, type ContentNamespace } from "../../lib/translators.ts";
import type { TranslateFn } from "../../lib/types.ts";

// landing/auth/common — зонные неймспейсы таска 05; фабрика типизирована под
// контентные неймспейсы таска 01, рантайм-резолв для этих скоупов — тот же стандартный.
const LANDING_NS = "landing" as ContentNamespace;
const AUTH_NS = "auth" as ContentNamespace;
const COMMON_NS = "common" as ContentNamespace;

/** Стандартный next-intl переводчик скоупа landing под текущую локаль. */
export function landingTranslator(): TranslateFn {
  return translatorFor(LANDING_NS, shimLocale());
}

/** Стандартный next-intl переводчик скоупа auth под текущую локаль. */
export function authTranslator(): TranslateFn {
  return translatorFor(AUTH_NS, shimLocale());
}

/** Стандартный next-intl переводчик скоупа common под текущую локаль. */
export function commonTranslator(): TranslateFn {
  return translatorFor(COMMON_NS, shimLocale());
}

// ─── Славянские плюралы (то же решение, что achieveCountT в dashboard) ───────

export type SlavicPluralKind = "One" | "Few" | "Many";

/**
 * Вид плюрала по-славянски: 1/21/31… → One, 2–4/22–24… → Few, иначе Many
 * (11–19 всегда Many). EN-ветка выбирается тем же ключом: One → singular,
 * Few/Many → plural (словари держат обе формы).
 */
export function slavicPluralKind(count: number): SlavicPluralKind {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "Many";
  if (last > 1 && last < 5) return "Few";
  if (last === 1) return "One";
  return "Many";
}

/** Диапазон сводки дорожной карты целой строкой словаря (R01.3): плюрал по hi. */
export function roadmapDurationT(t: TranslateFn, lo: number, hi: number): string {
  return t(`roadmapDuration${slavicPluralKind(hi)}`, { lo, hi });
}

/** Счётчик этапов сводки целой строкой словаря. */
export function roadmapStagesT(t: TranslateFn, count: number): string {
  return t(`roadmapStages${slavicPluralKind(count)}`, { count });
}

/** Счётчик задач сводки целой строкой словаря. */
export function roadmapTasksT(t: TranslateFn, count: number): string {
  return t(`roadmapTasks${slavicPluralKind(count)}`, { count });
}

/** Счётчик результатов сводки целой строкой словаря. */
export function roadmapResultsT(t: TranslateFn, count: number): string {
  return t(`roadmapResults${slavicPluralKind(count)}`, { count });
}

// ─── Размер файла — общий хелпер дашборда (T06) ───────────────────────────────
// Единая реализация — в features/dashboard/i18n.ts; здесь только реэкспорт,
// чтобы потребители misc не держали второй дубль того же кода.
export { formatSizeT } from "../dashboard/i18n.ts";

// ─── Роли вступления по токену (9 значений экрана join/[token]) ──────────────

/** Значение опции роли вступления по токену. */
export interface MiscJoinRoleOption {
  value: string;
  label: string;
}

/**
 * Роли вступления по токену через словарь auth (R01): язык задаёт словарь,
 * в коде русских литералов нет. Набор шире dashboard.getJoinRoles
 * (плюс tech_lead/project_curator — значения этого экрана).
 */
export function getJoinRoleOptions(t: TranslateFn): MiscJoinRoleOption[] {
  return [
    { value: "rd_executor", label: t("joinRoleRdExecutor") },
    { value: "scientific_org", label: t("joinRoleScientificOrg") },
    { value: "serial_manufacturer", label: t("joinRoleSerialManufacturer") },
    { value: "regulating_organization", label: t("joinRoleRegulatingOrg") },
    { value: "auditor", label: t("joinRoleAuditor") },
    { value: "investor", label: t("joinRoleInvestor") },
    { value: "participant", label: t("joinRoleParticipant") },
    { value: "tech_lead", label: t("joinRoleTechLead") },
    { value: "project_curator", label: t("joinRoleProjectCurator") },
  ];
}

// ─── Сентинел-коды llm-модуля (значения, не тексты) ──────────────────────────
// matching/llm.ts сравнивает их по === и никогда не показывает напрямую;
// показ — только через llmErrorText/llmReasonText ниже (R01).

/** Fallback недоступности LLM (401/5xx/исключение/пустой ответ). */
export const LLM_SENTINEL_UNAVAILABLE = "llm-unavailable";
/** Fallback при обнаруженных ПДн во входе rerank. */
export const LLM_SENTINEL_PII = "llm-pii-fallback";
/** Fallback при запрещённых ключах в теле LLM-запроса. */
export const LLM_SENTINEL_PAYLOAD_PII = "llm-payload-pii";
/** Причина кандидата по умолчанию (нет reason от бэка/LLM). */
export const LLM_REASON_SCRIPT = "registry-script";
/** Причина по умолчанию при успехе LLM без разобранных причин. */
export const LLM_REASON_TECH = "llm-tech-contour";

/**
 * Текст ошибки rerank для показа (R01): известные коды — через словарь,
 * неизвестные (тексты бэкенда, R04 вне рамок) — как есть.
 */
export function llmErrorText(t: TranslateFn, error: string | null | undefined): string | null {
  if (!error) return null;
  if (error === LLM_SENTINEL_UNAVAILABLE) return t("llmUnavailable");
  if (error === LLM_SENTINEL_PII) return t("llmPiiError");
  if (error === LLM_SENTINEL_PAYLOAD_PII) return t("llmPayloadError");
  return error;
}

/**
 * Причина кандидата для показа (R01): известные коды — через словарь,
 * остальные (бэкенд/LLM, данные) — как есть.
 */
export function llmReasonText(t: TranslateFn, reason: string | null | undefined): string {
  const r = reason ?? LLM_REASON_SCRIPT;
  if (r === LLM_REASON_SCRIPT) return t("llmReasonScript");
  if (r === LLM_REASON_TECH) return t("llmReasonTech");
  return r;
}

/**
 * Признак script-фолбэка причины (доделка 05): ветвление только по
 * сентинел-кодам и отсутствию причины, никакого сниффинга текста.
 */
export function isFallbackReason(reason: string | null | undefined): boolean {
  return reason == null || reason === LLM_REASON_SCRIPT || reason === LLM_REASON_TECH;
}

// ─── Вид KPI УГТ по ключам словаря (доделка 05) ─────────────────────────────

export type KpiKind = "publications" | "patents" | "prototype" | "other";

/**
 * Вид KPI по каноническим ключам ugt.kpiLabels текущей локали (доделка 05):
 * равенство ключам словаря вместо подстрок русского текста — в EN-ветке
 * работает так же, как в RU. Неизвестная метка — "other".
 */
export function kpiKindForLabel(tUgt: TranslateFn, label: string): KpiKind {
  if (label === tUgt("kpiLabels.publications")) return "publications";
  if (label === tUgt("kpiLabels.patents")) return "patents";
  if (label === tUgt("kpiLabels.prototype")) return "prototype";
  return "other";
}
