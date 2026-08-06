/**
 * T-008. Список запросов заказчика (/customer/requests).
 *
 * Данные — из workspace адаптера (scope кабинета, фикстуры помечены
 * бейджем «Тестовый пример для проверки интерфейса»). Пустой кабинет —
 * честное состояние «У вашей организации пока нет запросов» (STATES.md §3).
 */

import Link from "next/link";
import { Plus, SendHorizonal } from "lucide-react";
import { getAdapter } from "@/lib/adapter";
import { CustomerNav } from "@/components/customer/customer-nav";
import { RequestCard } from "@/components/customer/request-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default async function CustomerRequestsPage() {
  let requests;
  try {
    const workspace = await getAdapter().getWorkspace("customer");
    requests = workspace.requests.items;
  } catch {
    return (
      <div className={CONTAINER}>
        <CustomerNav />
        <ErrorState
          title="Не удалось загрузить запросы"
          description="Сервис данных временно недоступен. Повторите попытку позже."
          fallbackHref="/customer"
          fallbackLabel="В кабинет"
        />
      </div>
    );
  }

  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Запросы заказчика
          </h1>
          <p className="mt-1.5 text-small text-secondary">
            Проблемы и потребности организации, для которых нужны технологии,
            исполнители и пилоты
          </p>
        </div>
        <Link
          href="/customer/requests/new"
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Создать запрос
        </Link>
      </header>

      {requests.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="У вашей организации пока нет запросов"
            description="Опишите проблему или потребность — Центр подберёт проверенные технологии и исполнителей, а запрос сможет участвовать в пилотах."
            icon={SendHorizonal}
            action={
              <Link
                href="/customer/requests/new"
                className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Создать первый запрос
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
