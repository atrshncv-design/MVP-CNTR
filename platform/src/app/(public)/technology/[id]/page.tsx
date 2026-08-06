/**
 * T-007. Публичный паспорт технологии (/technology/[id]).
 *
 * Публичный режим: реальных технологий в реестре пока нет, адаптер
 * (getTechnology scope=public) честно возвращает null — показываем состояние
 * «Запись не опубликована / проходит проверку» (STATES.md §3, DATA-CONTRACTS
 * §2). Никакие фикстуры и внутренние данные в публичный вид не попадают.
 */

import Link from "next/link";
import { ArrowRight, FileQuestion, Search } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { EmptyState } from "@/components/states/empty-state";

export default async function PublicTechnologyDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Публичный scope: реальные записи вернутся после подключения данных;
  // фикстуры публично не показываются (адаптер возвращает null).
  let dossier = null;
  try {
    dossier = await getAdapter().getTechnology(id, "public");
  } catch {
    dossier = null;
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-3xl">
        {dossier ? (
          <p className="text-small text-secondary">
            Публичный паспорт технологии «{dossier.title}» появится здесь после
            публикации.
          </p>
        ) : (
          <EmptyState
            title="Запись не опубликована или проходит проверку"
            description="В публичный реестр технологии попадают только после проверки Центром: досье, свидетельства и уровень готовности УГТ. Если запись существует, она станет доступной после публикации. Пока в реестре нет ни одной опубликованной технологии."
            icon={FileQuestion}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/find"
                  className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  Найти решение
                </Link>
                <Link
                  href="/technologies"
                  className="inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  К реестру технологий
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            }
          />
        )}
      </div>
    </main>
  );
}
