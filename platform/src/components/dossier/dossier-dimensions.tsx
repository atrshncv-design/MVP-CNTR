/**
 * T-007. Четыре измерения готовности — текстовая разбивка (Design.md §11.6:
 * радар — дополнительный, текстовое объяснение обязательно).
 */

import type { TechnologyDossier } from "@/lib/types";

export interface DossierDimensionsProps {
  dossier: TechnologyDossier;
}

export function DossierDimensions({ dossier }: DossierDimensionsProps) {
  if (dossier.readiness.length === 0) {
    return (
      <section
        aria-labelledby="dimensions-heading"
        className="rounded-panel border border-subtle bg-surface p-6"
      >
        <h2
          id="dimensions-heading"
          className="text-h3 font-semibold tracking-tight text-primary"
        >
          Четыре измерения готовности
        </h2>
        <p className="mt-3 text-small leading-relaxed text-secondary">
          Оценка по измерениям ещё не проводилась — данные появятся после
          проверки Центром.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="dimensions-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="dimensions-heading"
        className="text-h3 font-semibold tracking-tight text-primary"
      >
        Четыре измерения готовности
      </h2>
      <p className="mt-1.5 text-meta text-muted">
        Научная, техническая, организационная и производственная готовность —
        по ГОСТ Р 58048-2017
      </p>
      <dl className="mt-5 space-y-4">
        {dossier.readiness.map((dimension) => (
          <div
            key={dimension.dimension}
            className="rounded-panel bg-canvas p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-small font-semibold text-primary">
                {dimension.dimension}
              </dt>
              <dd className="font-mono text-meta text-muted">
                {dimension.score}/10
              </dd>
            </div>
            <dd className="mt-1.5 text-small leading-relaxed text-secondary">
              {dimension.summary}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
