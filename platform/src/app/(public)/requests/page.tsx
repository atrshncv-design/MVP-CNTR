/**
 * T-006. Запросы заказчиков (/requests).
 *
 * «Раздел готов к наполнению»: публичных запросов в P0 нет, публикация
 * начнётся после запуска приёмной кампании. Честное состояние, следующий
 * шаг — реальный реестр НИОКТР (там уже есть исполнители и работы).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state.tsx";

export const metadata: Metadata = {
  title: "Запросы заказчиков — ЦНТР Удмуртии",
  description:
    "Потребности предприятий: проблема, ожидаемый результат и условия внедрения.",
};

export default function RequestsPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-16">
      <header className="max-w-3xl">
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Запросы заказчиков
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-secondary">
          Предприятия публикуют здесь потребности: описание проблемы,
          ожидаемый результат и условия внедрения. Исполнители и разработчики
          откликаются с готовыми решениями.
        </p>
      </header>

      <div className="mt-8">
        <EmptyState
          icon={FileText}
          title="Раздел готов к наполнению"
          description={
            <>
              Публикация запросов начнётся после запуска приёмной кампании.
              Каждый запрос проходит проверку Центром перед публикацией —
              в открытый доступ попадают только подтверждённые потребности
              предприятий.
            </>
          }
          action={
            <Link
              href="/research"
              className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Смотреть реестр НИОКТР
            </Link>
          }
        />
      </div>
    </div>
  );
}
