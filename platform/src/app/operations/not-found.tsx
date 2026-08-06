import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

/**
 * T-003. Ненайденный маршрут в операционном центре: раздел ещё не построен
 * (T-010) — честное состояние «в разработке» вместо голой 404.
 */
export default function OperationsNotFound() {
  return (
    <div className="mx-auto max-w-2xl">
      <EmptyState
        icon={FileQuestion}
        title="Раздел в разработке"
        description="Этот раздел операционного центра появится в одном из ближайших релизов. Вернитесь в операционный центр — там собраны доступные действия."
        action={
          <Link
            href="/operations"
            className="inline-flex h-11 items-center justify-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Вернуться в операционный центр
          </Link>
        }
      />
    </div>
  );
}
