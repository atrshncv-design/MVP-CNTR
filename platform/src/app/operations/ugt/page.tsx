/**
 * T-011. Справочник УГТ Центра (/operations/ugt).
 * Плотная таблица уровней + распределение проверенных уровней ТОЛЬКО
 * из данных (технологические досье-фикстуры, ugt.currentLevel).
 */

import { UGT_LEVELS } from "@/lib/ugt";
import { technologyDossierFixtures } from "@/data/fixtures";

const CONTAINER = "mx-auto w-full max-w-[1440px] px-5 py-8 md:px-8";

export default function OperationsUgtPage() {
  const dossiers = technologyDossierFixtures;

  // Распределение заявленных уровней по досье (реальные числа фикстур).
  const distribution = new Map<number, number>();
  for (const dossier of dossiers) {
    const level = dossier.ugt.currentLevel;
    distribution.set(level, (distribution.get(level) ?? 0) + 1);
  }

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          УГТ: справочник уровней
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          ГОСТ Р 58048-2017 · {dossiers.length} досье в контуре, распределение
          заявленных уровней — ниже
        </p>
      </header>

      <section
        aria-labelledby="dist-heading"
        className="mt-6 rounded-panel border border-subtle bg-surface p-5"
      >
        <h2 id="dist-heading" className="text-small font-semibold text-primary">
          Распределение заявленных уровней по досье
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {[...distribution.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([level, count]) => (
              <div
                key={level}
                className="min-w-[96px] rounded-panel bg-canvas p-3 text-center"
              >
                <p className="font-mono text-h3 font-semibold text-primary">
                  УГТ {level}
                </p>
                <p className="mt-1 text-meta text-muted">
                  {count} досье ({Math.round((count / dossiers.length) * 100)}%)
                </p>
              </div>
            ))}
        </div>
      </section>

      <div className="mt-6 overflow-x-auto rounded-panel border border-subtle bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-subtle bg-canvas/60">
              <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Уровень</th>
              <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Название (ГОСТ)</th>
              <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Диапазон</th>
              <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">Досье</th>
            </tr>
          </thead>
          <tbody>
            {UGT_LEVELS.map((level) => (
              <tr
                key={level.number}
                className="border-b border-border-subtle last:border-0 hover:bg-accent-soft/30"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-meta text-primary">
                  {level.code}
                </td>
                <td className="px-4 py-3 text-small text-primary">{level.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-meta text-muted">
                  {level.band === "low"
                    ? "низкая 1–3"
                    : level.band === "medium"
                      ? "средняя 4–6"
                      : "высокая 7–9"}
                </td>
                <td className="px-4 py-3 font-mono text-meta text-secondary">
                  {distribution.get(level.number) ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
