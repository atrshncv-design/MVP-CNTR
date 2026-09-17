import { MatchingMode } from "@/features/matching";

/**
 * Подбор исполнителей (таск 04, R04, G36).
 * Почему тонкая обёртка: вся логика — в MatchingMode (форма, POST /match,
 * 8 состояний, ретрай); страница только монтирует экран в ЛК.
 * Доступ — по матрице ролей (roles.ts, все аутентифицированные роли),
 * fail-closed через middleware; без LLM-ключа бэк отвечает скриптовым
 * режимом 200.
 */
export default function MatchingPage() {
  return <MatchingMode />;
}
