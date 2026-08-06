/**
 * D-03. Dev-демо радара четырёх измерений готовности (тикет 03-d03-radar.md).
 * Два блока: радар с данными (технология-фикстура) и пустое состояние
 * «Нет данных для радара». Семантика одинакова во всех трёх темах —
 * переключение через ThemeToggle, компонент использует только токены.
 */

"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { RadarChart } from "@/components/radar";
import { technologyDossierFixtures } from "@/data/fixtures/technologies";

/** Короткие подписи осей (Design.md §11.6: 4 измерения готовности). */
const DIMENSION_LABELS: Record<string, string> = {
  scientific: "Научная",
  technical: "Техническая",
  production: "Производственная",
  organizational: "Организационная",
};

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <hr className="section-divider" aria-hidden />
      <h2 className="mt-6 text-h2 font-semibold tracking-tight text-primary">
        {title}
      </h2>
      {intro ? (
        <p className="mt-2 max-w-2xl text-body leading-relaxed text-secondary">
          {intro}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* Данные: первое досье из контролируемых UI-фикстур (readiness 2/2/1/1). */
const fixture = technologyDossierFixtures[0];
const fixtureScores = fixture.readiness.map((item) => ({
  dimension: DIMENSION_LABELS[item.dimension] ?? item.dimension,
  score: item.score,
}));
const fixtureAriaLabel = `Радар готовности: ${fixtureScores
  .map((item) => `${item.dimension} ${item.score}`)
  .join(", ")}`;

export default function RadarDemoPage() {
  return (
    <div className="flex flex-1 justify-center bg-canvas">
      <div className="w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-meta text-muted">
              /dev/radar · D-03 · visual redesign
            </p>
            <h1 className="mt-3 text-h1 font-semibold tracking-tight text-primary">
              Радар четырёх измерений
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg leading-relaxed text-secondary">
              Чистый SVG-компонент без библиотек: полигон данных, контурная
              сетка, подписи осей. Цвета — только токены темы, поэтому радар
              перекрашивается вместе с темой.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Section
          id="data"
          title="Радар с данными"
          intro="4 оси готовности по ГОСТ Р 58048-2017. Слева — дефолтный размер 260, в центре — уменьшенный 200 (масштабирование по size), справа — переопределённый accent. Источник данных — контролируемая UI-фикстура (не реальная технология)."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-panel border border-subtle bg-surface p-6">
              <div className="flex justify-center">
                <RadarChart scores={fixtureScores} />
              </div>
              <p className="mt-5 text-center text-meta text-muted">
                size 260 · accent по умолчанию
              </p>
            </div>
            <div className="rounded-panel border border-subtle bg-surface p-6">
              <div className="flex justify-center">
                <RadarChart scores={fixtureScores} size={200} />
              </div>
              <p className="mt-5 text-center text-meta text-muted">
                size 200 · сетка пропорциональна
              </p>
            </div>
            <div className="rounded-panel border border-subtle bg-surface p-6">
              <div className="flex justify-center">
                <RadarChart scores={fixtureScores} accent="#a16207" />
              </div>
              <p className="mt-5 text-center text-meta text-muted">
                accent переопределён · #a16207
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-panel border border-subtle bg-surface p-6">
            <p className="text-small font-medium text-primary">
              Значения по измерениям (из досье)
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {fixtureScores.map((item) => (
                <div
                  key={item.dimension}
                  className="flex items-baseline justify-between gap-3 rounded-control bg-canvas px-4 py-3"
                >
                  <dt className="text-small font-medium text-primary">
                    {item.dimension}
                  </dt>
                  <dd className="font-mono text-meta text-muted">
                    {item.score}/10
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-meta text-muted">
              aria-label: {fixtureAriaLabel}
            </p>
            <p className="mt-2 text-meta text-muted">
              Источник: technologyDossierFixtures[0] — «Тестовый пример для
              проверки интерфейса», в публичные методы адаптера не попадает.
            </p>
          </div>
        </Section>

        <Section
          id="empty"
          title="Пустое состояние"
          intro="Когда оценка по измерениям ещё не проводилась, радар честно показывает контур без заливки и подпись — нулевой полигон не рисуется."
        >
          <div className="flex flex-wrap items-center gap-8 rounded-panel border border-subtle bg-surface p-6">
            <div className="flex justify-center">
              <RadarChart scores={[]} />
            </div>
            <div className="max-w-sm">
              <p className="text-small font-medium text-primary">
                Нет данных для радара
              </p>
              <p className="mt-2 text-small leading-relaxed text-secondary">
                Контур без заливки: оси станут видны, когда Центр проведёт
                оценку готовности по измерениям. aria-label — «Нет данных для
                радара».
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
