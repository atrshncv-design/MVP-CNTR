/**
 * Единый источник статусов проекта/технологии (тикет 01, R30/R31/R29).
 * Почему единый: 7 прежних дублей STATUS_LABELS/COLORS в разных файлах
 * расходились (active vs В работе vs Активен) и ломали фильтры/бейджи.
 * Теперь все файлы импортируют отсюда — расхождение невозможно.
 * 7 статусов из spec § Состояния: draft → auto_confirmed → published → active → completed (+ rejected/archived).
 */

// 7 основных статусов проекта (спека §1.6)
// draft → auto_confirmed → published → active → completed линейно,
// ответвления → rejected / archived
export type ProjectStatus =
  | "draft"
  | "auto_confirmed"
  | "published"
  | "active"
  | "completed"
  | "rejected"
  | "archived";

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "draft",
  "auto_confirmed",
  "published",
  "active",
  "completed",
  "rejected",
  "archived",
] as const;

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

/**
 * Человекочитаемые подписи статусов — используются в карточках, фильтрах, таблицах.
 * Значения сверены со спекой и существующими экранами (gk_customer, technologies etc).
 */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Черновик",
  auto_confirmed: "Подтверждён автоматически",
  published: "Опубликован",
  active: "В работе",
  completed: "Завершён",
  rejected: "Отклонён",
  archived: "В архиве",
};

/**
 * Легаси-алиасы статусов (старые значения из showcase/FRONT-01).
 * Нужны чтобы старые записи/фильтры не падали с undefined.
 * Маппим на канонические 7 статусов.
 */
export const LEGACY_STATUS_LABELS: Record<string, string> = {
  review: "На проверке",
  ...STATUS_LABELS,
};

export function getStatusLabel(status: string): string {
  if (status in STATUS_LABELS) return STATUS_LABELS[status as ProjectStatus];
  if (status in LEGACY_STATUS_LABELS) return LEGACY_STATUS_LABELS[status];
  return status;
}

/**
 * Цвета статусов — токены --tz-* (без инлайн-hex, дизайн-система красная).
 * Используются как style={{ color }} или для бейджей.
 */
export const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: "var(--tz-neutral)",
  auto_confirmed: "var(--tz-success)",
  published: "var(--tz-accent)",
  active: "var(--tz-accent)",
  completed: "var(--tz-success)",
  rejected: "var(--tz-danger)",
  archived: "var(--tz-neutral)",
};

/**
 * Бейдж-классы для статусов (тени .tz-badge-* из globals.css).
 * Используются как className={`tz-badge ${STATUS_BADGE[status]}`}.
 */
export const STATUS_BADGE: Record<ProjectStatus, string> = {
  draft: "tz-badge-neutral",
  auto_confirmed: "tz-badge-success",
  published: "tz-badge-accent",
  active: "tz-badge-accent",
  completed: "tz-badge-success",
  rejected: "tz-badge-danger",
  archived: "tz-badge-neutral",
};

export function getStatusColor(status: string): string {
  if (status in STATUS_COLORS) return STATUS_COLORS[status as ProjectStatus];
  // legacy review -> warning
  if (status === "review") return "var(--tz-review)";
  return "var(--tz-neutral)";
}

export function getStatusBadge(status: string): string {
  if (status in STATUS_BADGE) return STATUS_BADGE[status as ProjectStatus];
  if (status === "review") return "tz-badge-review";
  return "tz-badge-neutral";
}
