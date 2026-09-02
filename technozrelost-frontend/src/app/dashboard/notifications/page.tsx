// Страница /dashboard/notifications — список с фильтрами «Все/Непрочитано» (R26.1, 07)
// ALL_ROLES доступна всем ролям (матрица в src/lib/roles.ts). Использует
// features/notifications/NotificationsPage который тянет GET /notifications + POST /{id}/read через api-client.

import { NotificationsPage } from "@/features/notifications/NotificationsPage";

export default function Page() {
  return <NotificationsPage />;
}
