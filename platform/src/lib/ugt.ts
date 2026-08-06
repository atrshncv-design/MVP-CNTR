/**
 * T-005. Уровень готовности технологии (УГТ, ГОСТ Р 58048-2017).
 *
 * Диапазоны (Design.md §10, STATES.md §2): низкая готовность 1–3, средняя
 * 4–6, высокая 7–9. Цвет — не единственный канал: всегда число + название
 * уровня + band (форма/иконка + текст).
 *
 * Ключевое различие (STATES.md §2): «текущий уровень» (последний ПРОВЕРЕННЫЙ
 * уровень) и «переход N → N+1» — отдельные понятия. Непроверенный черновик
 * уровня нельзя показывать как финальный подтверждённый УГТ.
 *
 * Типы UgtBand/UgtLevelInfo объявлены в types.ts (T-004) — здесь добавляются
 * конкретные уровни, названия, диапазоны и мета перехода.
 */

import type { UgtBand, UgtLevelInfo } from "./types";

export type { UgtBand, UgtLevelInfo };

/** Названия уровней УГТ 1–9 (канон контура, совпадает с демо T-001). */
export const UGT_LEVELS: readonly UgtLevelInfo[] = [
  { number: 1, code: "УГТ 1", name: "Идея", short: "Идея", band: "low" },
  {
    number: 2,
    code: "УГТ 2",
    name: "Концепция",
    short: "Концепция",
    band: "low",
  },
  {
    number: 3,
    code: "УГТ 3",
    name: "Лаборатория",
    short: "Лаборатория",
    band: "low",
  },
  { number: 4, code: "УГТ 4", name: "Макет", short: "Макет", band: "medium" },
  {
    number: 5,
    code: "УГТ 5",
    name: "Прототип",
    short: "Прототип",
    band: "medium",
  },
  { number: 6, code: "УГТ 6", name: "Пилот", short: "Пилот", band: "medium" },
  {
    number: 7,
    code: "УГТ 7",
    name: "Опытный образец",
    short: "Опытный образец",
    band: "high",
  },
  {
    number: 8,
    code: "УГТ 8",
    name: "Серия 0",
    short: "Серия 0",
    band: "high",
  },
  {
    number: 9,
    code: "УГТ 9",
    name: "Производство",
    short: "Производство",
    band: "high",
  },
] as const;

/** Мета диапазона готовности (Design.md §10). */
export interface UgtBandMeta {
  band: UgtBand;
  /** Полная подпись. */
  label: string;
  /** Короткая подпись для компактных мест. */
  shortLabel: string;
  /** Диапазон уровней, например [1, 3]. */
  range: [number, number];
  /** Текстовая расшифровка диапазона. */
  description: string;
}

export const UGT_BAND_META: Record<UgtBand, UgtBandMeta> = {
  low: {
    band: "low",
    label: "Низкая готовность",
    shortLabel: "Низкая",
    range: [1, 3],
    description: "Идея, концепция, лабораторные исследования",
  },
  medium: {
    band: "medium",
    label: "Средняя готовность",
    shortLabel: "Средняя",
    range: [4, 6],
    description: "Макет, прототип, пилотное внедрение",
  },
  high: {
    band: "high",
    label: "Высокая готовность",
    shortLabel: "Высокая",
    range: [7, 9],
    description: "Опытный образец, серия 0, производство",
  },
};

/** Диапазон уровня в человекочитаемом виде: «1–3». */
export function bandRangeLabel(band: UgtBand): string {
  const [from, to] = UGT_BAND_META[band].range;
  return `${from}–${to}`;
}

/** Band по номеру уровня (1–9). Вне диапазона — null (не фабрикуем). */
export function bandOfLevel(level: number): UgtBand | null {
  const info = UGT_LEVELS.find((item) => item.number === level);
  return info ? info.band : null;
}

/** Информация об уровне 1–9. Вне диапазона — null. */
export function ugtLevelInfo(level: number): UgtLevelInfo | null {
  return UGT_LEVELS.find((item) => item.number === level) ?? null;
}

/** Валидный номер уровня УГТ (1–9). */
export function isValidUgtLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 9;
}

/** Короткая подпись: «УГТ 5». */
export function formatUgt(level: number): string {
  return `УГТ ${level}`;
}

/* ------------------------------------------------------------------ */
/* Переход N → N+1 (STATES.md §2: текущий уровень ≠ переход)           */
/* ------------------------------------------------------------------ */

/** Состояние перехода на следующий уровень. */
export type UgtTransitionState =
  | "not_started"
  | "preparing"
  | "under_review"
  | "approved"
  | "blocked";

export interface UgtTransitionMeta {
  state: UgtTransitionState;
  label: string;
  description: string;
}

export const UGT_TRANSITION_META: Record<UgtTransitionState, UgtTransitionMeta> =
  {
    not_started: {
      state: "not_started",
      label: "Переход не начат",
      description: "Свидетельства для следующего уровня ещё не собраны",
    },
    preparing: {
      state: "preparing",
      label: "Готовим переход",
      description: "Собираются свидетельства для перехода N → N+1",
    },
    under_review: {
      state: "under_review",
      label: "Переход на проверке",
      description: "Заявка на следующий уровень рассматривается",
    },
    approved: {
      state: "approved",
      label: "Переход одобрен",
      description: "Следующий уровень подтверждён проверкой",
    },
    blocked: {
      state: "blocked",
      label: "Переход заблокирован",
      description: "Нужно устранить блокер до подачи на следующий уровень",
    },
  };

/**
 * Текстовое объяснение позиции УГТ: текущий проверенный уровень и отдельно —
 * состояние перехода N → N+1. Никогда не смешивает их.
 *
 * @param currentLevel проверенный уровень (1–9)
 * @param transition состояние перехода на следующий уровень
 * @param verified ли уровень подтверждён проверкой (false = черновик)
 */
export function describeUgtPosition(
  currentLevel: number,
  transition: UgtTransitionState,
  verified: boolean,
): string {
  const info = ugtLevelInfo(currentLevel);
  const levelPart = verified
    ? `Текущий уровень: ${formatUgt(currentLevel)}${
        info ? ` (${info.name})` : ""
      } — подтверждён проверкой.`
    : `Заявленный уровень: ${formatUgt(currentLevel)}${
        info ? ` (${info.name})` : ""
      } — не подтверждён проверкой.`;
  const transitionMeta = UGT_TRANSITION_META[transition];
  return `${levelPart} ${transitionMeta.label}: ${transitionMeta.description}.`;
}
