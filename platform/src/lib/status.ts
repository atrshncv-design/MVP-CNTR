/**
 * T-005. Канонический словарь статусов платформы.
 *
 * Единая система статусов для технологий, запросов, документов, организаций,
 * рецензий и пилотов (STATES.md §1). Доменный объект может показывать свою
 * предметную подпись, но его семантическое состояние обязано маппиться на
 * этот словарь.
 *
 * Русские подписи, смысл и «типичное следующее действие» — СТРОГО по STATES.md
 * (никаких синонимов «В работе / Активно / Процесс» как взаимозаменяемых).
 *
 * Маппинг на токены тем: каждый статус имеет tone (success/warning/danger/
 * info/draft) → утилиты status-* (bg-status-*-soft, text-status-*), которые
 * одинаково работают во всех трёх темах (T-001).
 *
 * Тип Status/подписи STATUS_LABELS объявлены в types.ts (T-004) — здесь они
 * дополняются тональностью, смыслом и следующим действием, а не дублируются.
 */

import type { Status } from "./types";
import { STATUSES, STATUS_LABELS } from "./types";

export type { Status };
export { STATUSES, STATUS_LABELS };

/** Тональность статуса — маппинг на семантические токены тем. */
export type StatusTone = "success" | "warning" | "danger" | "info" | "draft";

/** Полная метаинформация канонического статуса. */
export interface StatusMeta {
  key: Status;
  /** Русская подпись (STATES.md §1). */
  label: string;
  /** Тональность → токены тем (bg-status-*-soft / text-status-*). */
  tone: StatusTone;
  /** Смысл статуса (STATES.md §1, колонка meaning). */
  meaning: string;
  /** Типичное следующее действие (STATES.md §1, колонка next action). */
  nextAction: string;
}

/**
 * Мета всех канонических статусов в порядке STATES.md §1.
 * Тональности: draft/archived — нейтральный; action_required/clarification —
 * предупреждение; under_review/approval/active — информация; approved/
 * published/closed — успех; rejected/blocked — ошибка.
 */
export const STATUS_META: Record<Status, StatusMeta> = {
  draft: {
    key: "draft",
    label: "Черновик",
    tone: "draft",
    meaning: "Начат, но не отправлен",
    nextAction: "Продолжить редактирование",
  },
  action_required: {
    key: "action_required",
    label: "Нужно действие",
    tone: "warning",
    meaning: "Участник или сотрудник должен действовать",
    nextAction: "Открыть задачу",
  },
  under_review: {
    key: "under_review",
    label: "На проверке",
    tone: "info",
    meaning: "Отправлено и проверяется",
    nextAction: "Ожидать или проверить заявку",
  },
  clarification: {
    key: "clarification",
    label: "Нужны уточнения",
    tone: "warning",
    meaning: "Проверяющий запросил недостающие или неясные сведения",
    nextAction: "Предоставить недостающие сведения",
  },
  approval: {
    key: "approval",
    label: "На согласовании",
    tone: "info",
    meaning: "Решение дооформляется",
    nextAction: "Ожидать решение",
  },
  approved: {
    key: "approved",
    label: "Одобрено",
    tone: "success",
    meaning: "Одобрено для соответствующего этапа процесса",
    nextAction: "Продолжить или опубликовать",
  },
  rejected: {
    key: "rejected",
    label: "Отклонено",
    tone: "danger",
    meaning: "Отклонено с указанием причины",
    nextAction: "Изучить причину и доработать",
  },
  published: {
    key: "published",
    label: "Опубликовано",
    tone: "success",
    meaning: "Видно в разрешённом публичном реестре",
    nextAction: "Открыть публичную запись",
  },
  active: {
    key: "active",
    label: "В работе",
    tone: "info",
    meaning: "Активный проект, запрос или пилот",
    nextAction: "Выполнить следующую задачу",
  },
  blocked: {
    key: "blocked",
    label: "Заблокировано",
    tone: "danger",
    meaning: "Не может продвигаться из-за зависимости",
    nextAction: "Устранить блокер",
  },
  archived: {
    key: "archived",
    label: "Архив",
    tone: "draft",
    meaning: "Больше не активно и не публично по умолчанию",
    nextAction: "Открыть архив",
  },
  closed: {
    key: "closed",
    label: "Завершено",
    tone: "success",
    meaning: "Процесс завершён",
    nextAction: "Посмотреть результат",
  },
};

/** Список мета-информации всех статусов в порядке STATES.md. */
export const STATUS_LIST: readonly StatusMeta[] = STATUSES.map(
  (key) => STATUS_META[key],
);

/** Тип-гард: значение — канонический статус. */
export function isCanonicalStatus(value: unknown): value is Status {
  return (
    typeof value === "string" && (STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Мета по статусу. Для неканонической строки (данные из будущего бэкенда)
 * возвращается честный fallback: сырая строка как подпись, нейтральная
 * тональность — без фабрикации смысла.
 */
export function getStatusMeta(status: Status | string): StatusMeta {
  if (isCanonicalStatus(status)) return STATUS_META[status];
  return {
    key: status as Status,
    label: status,
    tone: "draft",
    meaning: "Статус пока не сопоставлен со словарём STATES.md",
    nextAction: "",
  };
}

/* ------------------------------------------------------------------ */
/* Маппинг тональности на утилиты токенов тем                          */
/* ------------------------------------------------------------------ */

/** Бейдж-стили тональности: мягкий фон + контрастный текст (все темы). */
export const TONE_BADGE: Record<StatusTone, string> = {
  success: "bg-status-success-soft text-status-success",
  warning: "bg-status-warning-soft text-status-warning",
  danger: "bg-status-danger-soft text-status-danger",
  info: "bg-status-info-soft text-status-info",
  draft: "bg-status-draft-soft text-status-draft",
};

/** Текст-стили тональности. */
export const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-status-success",
  warning: "text-status-warning",
  danger: "text-status-danger",
  info: "text-status-info",
  draft: "text-status-draft",
};

/** Мягкий фон тональности (панели, блоки). */
export const TONE_SOFT_BG: Record<StatusTone, string> = {
  success: "bg-status-success-soft",
  warning: "bg-status-warning-soft",
  danger: "bg-status-danger-soft",
  info: "bg-status-info-soft",
  draft: "bg-status-draft-soft",
};

/** Сплошной цвет тональности (маркеры, иконки на заливке). */
export const TONE_SOLID: Record<StatusTone, string> = {
  success: "bg-status-success",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
  info: "bg-status-info",
  draft: "bg-status-draft",
};
