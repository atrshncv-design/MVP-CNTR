import { MatchingMode } from "@/features/matching";

/**
 * Страница отдельного режима подбора партнёров (тикет 05, R23, G27-G29).
 * Доступна всем 8 ролям — см. ROUTE_ALLOWED_ROLES /dashboard/matching.
 * Вход: выбор проекта (GET /projects где участник) или описание идеи.
 * Обезличивание contour tuno перед POST /match, топ≤5 с причинами.
 */
export default function MatchingPage() {
  return <MatchingMode />;
}
