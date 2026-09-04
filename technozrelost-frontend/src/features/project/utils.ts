/**
 * Утилиты карточки проекта — расчёт дробных секторов УГТ (тикет 03, G18).
 * Почему отдельный модуль: секторов в уровне = числу обязательных StageRequirement
 * для перехода current→next; прогресс красится цветом --tz-ugt-N. Логика
 * используется в UgtLine и Checklist, тестируется юнитом.
 */
import type { TranslateFn } from "@/lib/types";
import { projectTranslator } from "./i18n.ts";

// Fallback числа секторов per уровень, если бэк недоступен.
// Допущение в коде (тикет 03: «если бэка нет — мок 3-7 секторов per level»):
// УГТ5 → 7 секторов специально для теста: «при УГТ5 и 7 StageRequirement секторов 7, прогресс 3/7 = 3 закрашено цветом --tz-ugt-5».
export const FALLBACK_SECTORS: Record<number, number> = {
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 7,
  6: 3,
  7: 4,
  8: 5,
  9: 6,
};

export interface StageRequirementLike {
  id: number;
  from_level: number;
  to_level: number;
  title: string;
  description: string;
  template_version?: string;
  uploaded?: boolean;
}

/**
 * Число секторов для уровня.
 * Если переданы requirements — считаем реальные StageRequirement для этого уровня.
 * Иначе fallback по FALLBACK_SECTORS.
 */
export function getSectorsForLevel(
  level: number,
  requirements?: StageRequirementLike[] | null,
): number {
  if (requirements && requirements.length) {
    const filtered = requirements.filter((r) => r.from_level === level);
    if (filtered.length) return filtered.length;
    // если список уже отфильтрован под текущий уровень — возвращаем длину
    // (случай когда бэк отдаёт только current→next)
    // эвристика: если все from_level одинаковые и равны current-1, считаем что это тот уровень
    const uniqueFrom = new Set(requirements.map((r) => r.from_level));
    if (uniqueFrom.size === 1) return requirements.length;
  }
  return FALLBACK_SECTORS[level] ?? 4;
}

/**
 * Сколько секторов закрашено для текущего уровня.
 * Логика: закрашено = числу загруженных документов для этого уровня.
 */
export function getFilledSectors(
  level: number,
  currentLevel: number,
  requirements?: StageRequirementLike[] | null,
  uploadedCount?: number,
): number {
  if (level < currentLevel) {
    // пройденные уровни — полностью закрашены
    return getSectorsForLevel(level, requirements);
  }
  if (level > currentLevel) return 0;
  // текущий уровень
  const total = getSectorsForLevel(level, requirements);
  if (uploadedCount != null) return Math.min(uploadedCount, total);
  if (requirements) {
    const curReqs = requirements.filter((r) => r.from_level === level);
    const source = curReqs.length ? curReqs : requirements;
    return source.filter((r) => r.uploaded).length;
  }
  return 0;
}

export function getUgtColor(level: number): string {
  const lvl = Math.max(1, Math.min(9, level));
  return `var(--tz-ugt-${lvl})`;
}

/**
 * Хелпер для бейджа возврата G50 — hard-gate.
 * Тексты — из словаря project через переводчик (обе локали, подстановки
 * параметрами, без склейки фрагментов в коде). Причина без значения —
 * переведённое слово returnNoReason как параметр, а не конкатенация.
 * Используется в карточке проекта и истории AuditTrail (стрелка назад).
 */
export function getReturnBadgeT(
  t: TranslateFn,
  status: string,
  rejectionReason?: string | null,
  fromLevel?: number | null,
): string | null {
  if (status !== "rejected" && status !== "rejected_by_manager" && status !== "No-Go" && status !== "no_go") return null;
  const reason = rejectionReason?.trim() ? rejectionReason.trim() : t("returnNoReason");
  if (fromLevel != null) return t("returnWithLevel", { level: fromLevel, reason });
  return t("returnWithoutLevel", { reason });
}

/**
 * Совместимость (HardGateBadge вне зоны, старые вызовы): та же семантика,
 * тексты через зонный переводчик текущей локали. Новых литералов не вводит.
 */
export function getReturnBadge(
  status: string,
  rejectionReason?: string | null,
  fromLevel?: number | null,
): string | null {
  return getReturnBadgeT(projectTranslator(), status, rejectionReason, fromLevel);
}

/** Проверка hard-gate: rejected статус проекта или КТ */
export function isHardGateRejected(projectStatus?: string | null, controlPointStatus?: string | null): boolean {
  const normalized = (s?: string | null) => (s ?? "").toLowerCase();
  return normalized(projectStatus) === "rejected" || normalized(controlPointStatus) === "rejected" || normalized(controlPointStatus) === "no-go";
}
