import Link from "next/link";
import { FileUp } from "lucide-react";
import { getAdapter } from "@/lib/adapter/index.ts";
import { BACKEND_ROLES } from "@/lib/roles.ts";
import { technologySummaryFixtures } from "@/data/fixtures/technologies.ts";
import { GeometryDivider } from "@/components/udmurt/geometry-divider";
import {
  CONTAINER,
  HeroSection,
  LevelsSection,
  MapSection,
  RecentSection,
  RegistrySection,
  RolesSection,
  StepsSection,
} from "@/components/home/home-sections";

/**
 * D-04. Главная страница — «живой первый экран и плотность контента».
 *
 * Композиция (тикет 04-d04-home-density.md, спека Q4/A5/A6):
 *   1. hero-комбо: заголовок + два действия + радар 4 измерений (честное
 *      «нет данных» — фикстуры в публичный scope не попадают) + мини-трек
 *      УГТ + мини-счётчики из данных;
 *   2. «Сейчас на платформе» — живые ссылки на реестры с реальными
 *      счётчиками (никакого «Раздел готов к наполнению» на первом экране);
 *   3. «Как это работает» — нумерованные шаги 01/02/03;
 *   4. «Экосистема участников» — 9 ролей (roles.ts, зеркало ROLES.md);
 *   5. «Что означает уровень» — компактные ссылки УГТ 1–9 (токены шкалы);
 *   6. «Последние верифицированные записи» — реальные карточки НИОКТР;
 *   7. карта экосистемы — сжатый честный блок ниже, не на первом экране;
 *   8. разделители секций — GeometryDivider (D-06).
 *
 * Данные: getAdapter().getHomeSummary() — только реальные записи (400
 * карточек НИОКТР); счётчик «досье в проверке» — из контролируемых
 * UI-фикстур в статусах under_review/clarification (единственные досье
 * в контуре проверки; в публичные методы адаптера фикстуры не попадают).
 */

export default async function HomePage() {
  const summary = await getAdapter().getHomeSummary();

  /* Досье в проверке: фикстуры в статусах under_review/clarification —
     честное число досье, находящихся в контуре проверки Центра. */
  const inReviewCount = technologySummaryFixtures.filter(
    (item) =>
      item.verificationStatus === "under_review" ||
      item.verificationStatus === "clarification",
  ).length;

  return (
    <div>
      {/* 1. Hero-комбо */}
      <HeroSection
        researchCount={summary.researchCount}
        rolesCount={BACKEND_ROLES.length}
        inReviewCount={inReviewCount}
      />

      <div className={CONTAINER}>
        <GeometryDivider />
      </div>

      {/* 2. Сейчас на платформе: живые ссылки на реестры */}
      <RegistrySection
        researchCount={summary.researchCount}
        inReviewCount={inReviewCount}
      />

      <div className={CONTAINER}>
        <GeometryDivider />
      </div>

      {/* 3. Как это работает */}
      <StepsSection />

      <div className={CONTAINER}>
        <GeometryDivider />
      </div>

      {/* 4. Экосистема участников */}
      <RolesSection />

      <div className={CONTAINER}>
        <GeometryDivider />
      </div>

      {/* 5. Что означает уровень */}
      <LevelsSection />

      <div className={CONTAINER}>
        <GeometryDivider />
      </div>

      {/* 6. Последние верифицированные записи */}
      <RecentSection records={summary.recentResearch} />

      <div className={CONTAINER}>
        <GeometryDivider />
      </div>

      {/* 7. Карта экосистемы — сжатый честный блок */}
      <MapSection />

      {/* 8. Приглашение зарегистрироваться / связаться с Центром */}
      <section className={`${CONTAINER} pb-16 pt-4 md:pb-24`}>
        <div className="flex flex-col gap-8 rounded-surface bg-accent-soft p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="max-w-xl">
            <h2 className="text-h2 font-semibold tracking-tight text-primary">
              Представьте технологию или найдите решение
            </h2>
            <p className="mt-3 text-body leading-relaxed text-secondary">
              Зарегистрируйтесь, чтобы создать досье технологии, отвечать на
              запросы заказчиков, находить партнёров и участвовать в пилотах.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent-strong px-6 text-sm font-semibold text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <FileUp className="h-4 w-4" aria-hidden />
              Подать технологию
            </Link>
            <Link
              href="/about"
              className="inline-flex h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-6 text-sm font-semibold text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Связаться с Центром
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
