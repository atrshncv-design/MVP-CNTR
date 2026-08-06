import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

/**
 * T-003. Ненайденный маршрут в кабинете: раздел ещё не построен (тикеты
 * кабинетов T-008/T-009 и далее) — честное состояние «в разработке»
 * вместо голой 404 (AC «нет доступа → состояние, не пустота»).
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-2xl">
      <EmptyState
        icon={FileQuestion}
        title="Раздел в разработке"
        description="Этот раздел кабинета появится в одном из ближайших релизов. Вернитесь в рабочее место — там собраны доступные действия."
        action={
          <Link
            href="/app"
            className="inline-flex h-11 items-center justify-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Вернуться в Workspace
          </Link>
        }
      />
    </div>
  );
}
