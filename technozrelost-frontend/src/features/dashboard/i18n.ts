/**
 * Зонный переводчик неймспейса dashboard для мест без хука useTranslations
 * (чистые утилиты, серверный layout через getTranslations, подписи радара).
 * Построен через фабрику таска 01 (translatorFor/shimLocale из
 * src/lib/translators.ts) — своего wiring (createTranslator, импорт
 * словарей) здесь нет. Локаль — текущая (cookie NEXT_LOCALE, иначе
 * default приложения).
 */
import { shimLocale, translatorFor, type ContentNamespace } from "../../lib/translators.ts";
import type { TranslateFn } from "../../lib/types.ts";

// dashboard — зонный неймспейс таска 04; фабрика типизирована под контентные
// неймспейсы таска 01, рантайм-резолв для скоупа dashboard — тот же стандартный.
const DASHBOARD_NS = "dashboard" as ContentNamespace;

/** Стандартный next-intl переводчик скоупа dashboard под текущую локаль. */
export function dashboardTranslator(): TranslateFn {
  return translatorFor(DASHBOARD_NS, shimLocale());
}

/** Категории осей радара готовности (совпадают с RadarCategory в project-radar). */
export type RadarAxisId = "scientific" | "technical" | "organizational" | "production";

/**
 * Подпись оси радара через словарь (R01.2): порядок и язык задаёт словарь,
 * в коде русских литералов нет. Ключевые стемы матчинга документов
 * (KEYWORD_RULES в project-radar) — рабочее тело функции, не трогаем.
 */
export function radarAxisLabel(t: TranslateFn, axis: RadarAxisId): string {
  switch (axis) {
    case "scientific":
      return t("radarAxisScientific");
    case "technical":
      return t("radarAxisTechnical");
    case "organizational":
      return t("radarAxisOrganizational");
    case "production":
      return t("radarAxisProduction");
  }
}

/**
 * Aria-описание радара целой строкой словаря с параметрами (R01.3):
 * порядок слов в EN задаёт словарь, никакой склейки в коде.
 */
export function radarAria(
  t: TranslateFn,
  values: { scientific: string; technical: string; organizational: string; production: string },
): string {
  return t("radarAria", values);
}

/**
 * Статус новости для бейджа карточки (совпадает с NewsStatus в news-types).
 * Неизвестный статус — как есть (данные бэкенда, не UI-строка).
 */
export function getNewsStatusLabel(t: TranslateFn, status: string): string {
  switch (status) {
    case "draft":
      return t("newsStatusDraft");
    case "scheduled":
      return t("newsStatusScheduled");
    case "published":
      return t("newsStatusPublished");
    default:
      return status;
  }
}

/**
 * Статус антивирусной проверки файла для бейджа (совпадает со scan_status API).
 * Неизвестный статус — как есть.
 */
export function getScanLabel(t: TranslateFn, status: string): string {
  switch (status) {
    case "pending":
      return t("filesScanPending");
    case "clean":
      return t("filesScanClean");
    case "infected":
      return t("filesScanInfected");
    case "error":
      return t("filesScanError");
    default:
      return status;
  }
}

/** Классы бейджей сканирования (токены палитры, не текст — вне словаря). */
export const SCAN_CLASSES: Record<string, string> = {
  pending: "tz-badge-review",
  clean: "tz-badge-success",
  infected: "tz-badge-danger",
  error: "tz-badge-danger",
};

/**
 * Группа достижений для фильтров витрины. Неизвестная группа — как есть.
 */
export function getAchievementGroupLabel(t: TranslateFn, group: string): string {
  switch (group) {
    case "ugt":
      return t("achieveGroupUgt");
    case "documents":
      return t("achieveGroupDocuments");
    case "project":
      return t("achieveGroupProject");
    case "quality":
      return t("achieveGroupQuality");
    case "sector":
      return t("achieveGroupSector");
    case "role":
      return t("achieveGroupRole");
    case "member":
      return t("achieveGroupMember");
    case "organization":
      return t("achieveGroupOrganization");
    case "secret":
      return t("achieveGroupSecret");
    default:
      return group;
  }
}

/** Значение опции роли вступления по токену. */
export interface JoinRoleOption {
  value: string;
  label: string;
}

/**
 * Роли вступления по токену через словарь (R01): язык задаёт словарь,
 * в коде русских литералов нет.
 */
export function getJoinRoles(t: TranslateFn): JoinRoleOption[] {
  return [
    { value: "rd_executor", label: t("joinFormRoleRdExecutor") },
    { value: "scientific_org", label: t("joinFormRoleScientificOrg") },
    { value: "serial_manufacturer", label: t("joinFormRoleSerialManufacturer") },
    { value: "regulating_organization", label: t("joinFormRoleRegulatingOrg") },
    { value: "auditor", label: t("joinFormRoleAuditor") },
    { value: "investor", label: t("joinFormRoleInvestor") },
    { value: "participant", label: t("joinFormRoleParticipant") },
  ];
}

/**
 * Счётчик медалей витрины через словарь (R01.3): плюралы — ключами
 * one/few/many (то же решение, что projectOne/Few/Many в executors),
 * в коде русских окончаний нет.
 */
export function achieveCountT(t: TranslateFn, count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  const params = { count: String(count) };
  if (abs > 10 && abs < 20) return t("achieveCountMany", params);
  if (last > 1 && last < 5) return t("achieveCountFew", params);
  if (last === 1) return t("achieveCountOne", params);
  return t("achieveCountMany", params);
}

/**
 * Человекочитаемый размер файла целыми строками словаря (R01.3):
 * единицы измерения — часть перевода, никакой склейки в коде.
 */
export function formatSizeT(t: TranslateFn, bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return t("filesSizeB", { bytes: String(bytes) });
  if (bytes < 1024 * 1024) return t("filesSizeKb", { value: (bytes / 1024).toFixed(1) });
  return t("filesSizeMb", { value: (bytes / 1024 / 1024).toFixed(1) });
}
