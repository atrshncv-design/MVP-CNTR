/**
 * T-009. Создание досье технологии (/app/partner/technologies/new).
 *
 * Форма — клиентский компонент TechnologySubmitForm: прогрессивное
 * раскрытие, требования к доказательствам ДО длинной формы, автосохранение
 * черновика в localStorage (навигация назад/вперёд не теряет ввод),
 * field-level валидация, «что будет после подачи».
 */

import { PartnerNav } from "@/components/partner/partner-nav";
import { TechnologySubmitForm } from "@/components/partner/technology-submit-form";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function NewPartnerTechnologyPage() {
  return (
    <div className={CONTAINER}>
      <PartnerNav />

      <header className="max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Представить технологию
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Опишите технологию и заявленный уровень УГТ. Сначала оцените
          требования к доказательствам, затем заполните форму. Черновик
          сохраняется автоматически — можно вернуться позже. Созданное досье
          получает статус «Черновик»: доказательства прикладываются на странице
          досье, подача на проверку доступна после их приложения.
        </p>
      </header>

      <div className="mt-8 max-w-6xl">
        <TechnologySubmitForm />
      </div>
    </div>
  );
}
