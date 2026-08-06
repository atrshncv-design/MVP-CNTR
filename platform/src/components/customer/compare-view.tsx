/**
 * T-008. Сравнение технологий (Design.md §13.2, шаг 4).
 *
 * Клиентский компонент: выбор технологий чекбоксами (персистится в
 * localStorage `nfr-compare-selection`), таблица сравнения на desktop,
 * стек-карточки на mobile (тикет T-008: «таблицы → стек-карточки»).
 * Сравниваются УГТ, готовность, отрасли, организация, статус верификации,
 * свидетельства и оси готовности (readiness) — доступные доказательства.
 * Пустое состояние — честное: «Выберите технологии для сравнения».
 */

"use client";

import { useEffect, useState } from "react";
import { Columns3 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { isFixtureRecord, type TechnologyDossier } from "@/lib/types";
import { UGT_BAND_META, ugtLevelInfo } from "@/lib/ugt";
import {
  readCompareSelection,
  writeCompareSelection,
} from "@/lib/customer-storage";

export interface CompareViewProps {
  /** Все доступные технологии кабинета (досье-фикстуры). */
  technologies: TechnologyDossier[];
}

const DIMENSION_LABELS: Record<string, string> = {
  scientific: "Научная готовность",
  technical: "Техническая готовность",
  production: "Производственная готовность",
  organizational: "Организационная готовность",
};

function readinessScore(tech: TechnologyDossier, dimension: string): number | null {
  const item = tech.readiness.find((r) => r.dimension === dimension);
  return item ? item.score : null;
}

export function CompareView({ technologies }: CompareViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setSelectedIds(readCompareSelection());
    })();
  }, []);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    writeCompareSelection(next);
  };

  const selected = technologies.filter((t) => selectedIds.includes(t.id));

  if (selected.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-subtle bg-surface px-5 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-control bg-canvas" aria-hidden>
          <Columns3 className="h-5 w-5 text-muted" strokeWidth={1.75} />
        </span>
        <p className="mt-3 text-small font-medium text-primary">
          Выберите технологии для сравнения
        </p>
        <p className="mt-1 max-w-md text-meta leading-relaxed text-muted">
          Отметьте 2–4 технологии в списке ниже, чтобы сравнить УГТ,
          доказательства и готовность к внедрению.
        </p>
      </div>
    );
  }

  const rows: Array<{
    label: string;
    value: (tech: TechnologyDossier) => React.ReactNode;
  }> = [
    {
      label: "УГТ",
      value: (t) => <UgtBadge level={t.ugt.currentLevel} showBand={false} />,
    },
    {
      label: "Готовность",
      value: (t) => (
        <span className="text-small text-secondary">
          {UGT_BAND_META[t.ugt.band].label}
        </span>
      ),
    },
    {
      label: "Отрасль",
      value: (t) => (
        <span className="text-small text-secondary">
          {t.industries.length > 0 ? t.industries.join(", ") : "—"}
        </span>
      ),
    },
    {
      label: "Организация",
      value: (t) => (
        <span className="text-small text-secondary">{t.organization.name}</span>
      ),
    },
    {
      label: "Статус верификации",
      value: (t) => (
        <StatusBadge status={t.visibility.publicationStatus} size="sm" />
      ),
    },
    {
      label: "Свидетельства",
      value: (t) => (
        <span className="text-small font-medium text-primary">
          {t.evidence.length > 0 ? `${t.evidence.length} шт.` : "нет"}
        </span>
      ),
    },
    ...Object.keys(DIMENSION_LABELS).map((dim) => ({
      label: DIMENSION_LABELS[dim],
      value: (t: TechnologyDossier) => {
        const score = readinessScore(t, dim);
        return (
          <span className="text-small font-medium text-primary">
            {score !== null ? `${score} / 5` : "—"}
          </span>
        );
      },
    })),
  ];

  return (
    <div>
      {/* Выбор технологий */}
      <ul className="mb-5 space-y-2">
        {technologies.map((tech) => {
          const checked = selectedIds.includes(tech.id);
          return (
            <li key={tech.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition-colors ${
                  checked
                    ? "border-accent bg-accent-soft/40"
                    : "border-subtle bg-surface hover:border-strong"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(tech.id)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium text-primary">
                    {tech.title}
                  </span>
                  <span className="mt-0.5 block text-meta text-muted">
                    {isFixtureRecord(tech) ? "Тестовый пример · " : ""}
                    УГТ {tech.ugt.currentLevel} · {tech.organization.name}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Desktop: таблица */}
      <div className="hidden overflow-hidden rounded-panel border border-subtle bg-surface md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-subtle bg-canvas/60">
              <th scope="col" className="w-52 px-4 py-3 text-meta font-medium text-muted">
                Параметр
              </th>
              {selected.map((t) => (
                <th
                  key={t.id}
                  scope="col"
                  className="min-w-44 px-4 py-3 align-top text-small font-semibold leading-snug text-primary"
                >
                  <span className="line-clamp-2">{t.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="px-4 py-3 align-top text-meta font-medium text-muted"
                >
                  {row.label}
                </th>
                {selected.map((t) => (
                  <td key={t.id} className="px-4 py-3 align-top">
                    {row.value(t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: стек-карточки */}
      <ul className="space-y-4 md:hidden">
        {selected.map((t) => {
          const info = ugtLevelInfo(t.ugt.currentLevel);
          return (
            <li key={t.id} className="rounded-panel border border-subtle bg-surface p-5">
              <h4 className="text-small font-semibold leading-snug text-primary">
                {t.title}
              </h4>
              <dl className="mt-3 space-y-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <dt className="shrink-0 text-meta text-muted">{row.label}</dt>
                    <dd className="min-w-0 text-right">{row.value(t)}</dd>
                  </div>
                ))}
              </dl>
              {info ? (
                <p className="mt-3 border-t border-subtle pt-3 text-meta leading-relaxed text-muted">
                  {info.name} — {info.short}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
