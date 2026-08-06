/**
 * T-008. Шорт-листы заказчика (/customer/shortlists).
 *
 * Клиентская страница: технологии кабинета передаются в ShortlistWorkspace,
 * хранилище — localStorage (customer-storage). Пустой шорт-лист — честное
 * состояние с путём в поиск.
 */

"use client";

import { CustomerNav } from "@/components/customer/customer-nav";
import { ShortlistWorkspace } from "@/components/customer/shortlist";
import { technologyDossierFixtures } from "@/data/fixtures";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function ShortlistsPage() {
  return (
    <div className={CONTAINER}>
      <CustomerNav />

      <header className="max-w-3xl">
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Шорт-листы
        </h1>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          Сохраняйте перспективные технологии, сравнивайте готовность и
          доказательства, возвращайтесь к решению позже.
        </p>
      </header>

      <div className="mt-8">
        <ShortlistWorkspace technologies={technologyDossierFixtures} />
      </div>
    </div>
  );
}
