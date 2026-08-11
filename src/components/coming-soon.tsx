/**
 * ComingSoon — единый компонент страниц разделов, находящихся в разработке
 * (тикет 06, operations-modules).
 *
 * Контракт «честных границ»:
 * - Только заголовок, описание будущей цели и статус «В разработке».
 * - Описание НЕ обещает готовую функцию и не содержит вымышленных
 *   показателей/контента.
 * - НЕТ интерактивных элементов: ни кнопок, ни форм, ни ссылок-заглушек,
 *   ни мок-данных. Компонент серверный (без директивы use client, без
 *   состояния и сетевых запросов).
 *
 * Бэкенд-авторизация разделов не заменяется скрытием UI: доступ к маршрутам
 * ограничен middleware (src/middleware.ts через ROUTE_ALLOWED_ROLES) и backend.
 */

export default function ComingSoon({
  title,
  description,
  status = "В разработке",
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <section
      aria-labelledby="coming-soon-title"
      className="mx-auto max-w-2xl py-12"
    >
      <p className="mb-4 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-amber-300">
        {status}
      </p>
      <h1
        id="coming-soon-title"
        className="mb-4 text-2xl font-bold text-tz-fg sm:text-3xl"
      >
        {title}
      </h1>
      <p className="text-base leading-relaxed text-tz-secondary">{description}</p>
    </section>
  );
}
