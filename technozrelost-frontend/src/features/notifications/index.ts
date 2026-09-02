// Публичный API модуля notifications (интерфейс из spec.md § Границы и швы)
// Выставляет NotificationBell() и NotificationsPage(), прячет SSE, read mutation.

export { useNotifications } from "./useNotifications";
export { useNotificationsStream } from "./useNotificationsStream";
export { SessionExpiredModal } from "./SessionExpiredModal";
export { NotificationsPage } from "./NotificationsPage";
export * from "./draft";
