/**
 * T-011. Публичная методология УГТ 1–9 (/methodology/ugt).
 * Тексты уровней — из ГОСТ Р 58048-2017 (Design.md §11.1), ничего
 * не выдумано. «Как Центр подтверждает уровень» — честное пояснение.
 */

import { ShieldCheck } from "lucide-react";
import { UGT_LEVELS } from "@/lib/ugt";
import { UgtTrack } from "@/components/ugt/ugt-track";
import { UgtLevelCard } from "@/components/ugt/ugt-level-card";

export default function MethodologyUgtPage() {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-14">
      <header className="max-w-3xl">
        <p className="font-mono text-meta text-muted">
          Методология · ГОСТ Р 58048-2017
        </p>
        <h1 className="mt-2 text-h1 font-semibold tracking-tight text-primary">
          Уровни готовности технологии: путь от идеи к серийному производству
        </h1>
        <p className="mt-4 text-body leading-relaxed text-secondary">
          УГТ — расстояние до конкретного результата внедрения, а не общая
          оценка качества. Готовность оценивается по четырём измерениям:
          научная, техническая, организационная и производственная. Шкала
          включает девять уровней в трёх диапазонах.
        </p>
      </header>

      <section
        aria-labelledby="bands-heading"
        className="mt-10 max-w-4xl rounded-panel border border-subtle bg-surface p-6"
      >
        <h2 id="bands-heading" className="text-h3 font-semibold tracking-tight text-primary">
          Диапазоны готовности
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { range: "1–3", label: "Низкая готовность", text: "Идея, концепция и лабораторное подтверждение." },
            { range: "4–6", label: "Средняя готовность", text: "Макет, испытания в условиях, близких к реальным." },
            { range: "7–9", label: "Высокая готовность", text: "Опытный образец, эксплуатация, серийное производство." },
          ].map((band) => (
            <div key={band.range} className="rounded-panel bg-canvas p-4">
              <p className="font-mono text-meta text-muted">УГТ {band.range}</p>
              <p className="mt-1 text-small font-semibold text-primary">{band.label}</p>
              <p className="mt-1 text-small leading-relaxed text-secondary">{band.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <UgtTrack currentLevel={1} verified={false} />
        </div>
      </section>

      <section
        aria-labelledby="levels-heading"
        className="mt-10 max-w-4xl"
      >
        <h2 id="levels-heading" className="text-h2 font-semibold tracking-tight text-primary">
          Уровни 1–9
        </h2>
        <div className="mt-6 space-y-5">
          {UGT_LEVELS.map((level) => (
            <UgtLevelCard key={level.number} level={level.number} />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="verify-heading"
        className="mt-10 max-w-4xl rounded-panel border border-subtle bg-surface p-6"
      >
        <h2
          id="verify-heading"
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
          Как Центр подтверждает уровень
        </h2>
        <p className="mt-3 text-small leading-relaxed text-secondary">
          Заявленный исполнителем уровень становится подтверждённым только
          после проверки комплекта доказательств специалистами Центра.
          Пока проверка не завершена, в публичных реестрах запись не
          публикуется, а уровень показывается как «не подтверждён проверкой».
          После проверки зафиксированный уровень попадает в досье технологии
          с датой верификации.
        </p>
      </section>
    </main>
  );
}
