/**
 * T-007. Проблема и решение технологии (Design.md §5.2, секции 2–3).
 */

import { Lightbulb, Target } from "lucide-react";
import type { TechnologyDossier } from "@/lib/types";

export interface DossierProblemSolutionProps {
  dossier: TechnologyDossier;
}

export function DossierProblemSolution({ dossier }: DossierProblemSolutionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="problem-heading"
        className="rounded-panel border border-subtle bg-surface p-6"
      >
        <h2
          id="problem-heading"
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          <Target className="h-5 w-5 text-accent" aria-hidden />
          Проблема
        </h2>
        <p className="mt-3 text-body leading-relaxed text-primary">
          {dossier.problem}
        </p>
      </section>

      <section
        aria-labelledby="solution-heading"
        className="rounded-panel border border-subtle bg-surface p-6"
      >
        <h2
          id="solution-heading"
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          <Lightbulb className="h-5 w-5 text-accent" aria-hidden />
          Решение
        </h2>
        <p className="mt-3 text-body leading-relaxed text-primary">
          {dossier.solution}
        </p>
      </section>

      {dossier.applicationAreas.length > 0 ? (
        <section
          aria-labelledby="areas-heading"
          className="rounded-panel border border-subtle bg-surface p-6 lg:col-span-2"
        >
          <h2
            id="areas-heading"
            className="text-h3 font-semibold tracking-tight text-primary"
          >
            Области применения
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {dossier.applicationAreas.map((area) => (
              <li
                key={area}
                className="rounded-[6px] border border-border-subtle bg-canvas px-3 py-1.5 text-small text-secondary"
              >
                {area}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
