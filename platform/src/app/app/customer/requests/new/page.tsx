/**
 * T-008. Создание запроса заказчика (/customer/requests/new).
 *
 * Форма — клиентский компонент RequestForm: пошаговое раскрытие,
 * автocохранение черновика в localStorage (навигация назад/вперёд не теряет
 * ввод), field-level валидация, «что будет после подачи».
 */

import { CustomerNav } from "@/components/customer/customer-nav";
import { RequestForm } from "@/components/customer/request-form";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function NewCustomerRequestPage() {
  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Новый запрос заказчика
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Опишите проблему: отрасль, ограничения и желаемый результат. Черновик
          сохраняется автоматически — можно вернуться позже. После подачи запрос
          проходит проверку Центра (статус «На проверке»).
        </p>
      </header>

      <div className="mt-8 max-w-3xl">
        <RequestForm />
      </div>
    </div>
  );
}
