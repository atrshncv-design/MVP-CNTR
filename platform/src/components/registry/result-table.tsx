/**
 * T-006. Таблица результатов реестра НИОКТР (desktop, Design.md §8.3:
 * плотные таблицы на десктопе → стек-карточки на мобильных).
 * Показывается только на md+ (родитель скрывает на мобильных),
 * карточки ResearchCard — на мобильных.
 */

import Link from "next/link";
import { Building2 } from "lucide-react";
import type { ResearchRecord } from "@/lib/types.ts";
import { StatusBadge } from "@/components/status-badge.tsx";
import { AiTag, researchYear } from "./result-card.tsx";
import { ProvenanceBadge } from "./provenance-badge.tsx";

export function ResearchTable({ records }: { records: ResearchRecord[] }) {
  return (
    <div className="overflow-hidden rounded-panel border border-subtle bg-surface">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Реестр НИОКТР: регистрационный номер, название, исполнитель, тип
          работ, год, тематика ИИ, источник
        </caption>
        <thead>
          <tr className="border-b border-subtle bg-canvas/60 text-meta uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 font-medium">
              Рег. №
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Название
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Исполнитель
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Тип работ
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Год
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              ИИ
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Источник
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {records.map((record) => {
            const year = researchYear(record);
            return (
              <tr
                key={record.registrationNumber}
                className="align-top transition-colors hover:bg-surface-elevated/60"
              >
                <td className="px-4 py-3.5">
                  <span className="whitespace-nowrap font-mono text-meta text-muted">
                    {record.registrationNumber}
                  </span>
                </td>
                <td className="max-w-[420px] px-4 py-3.5">
                  <Link
                    href={`/research/${encodeURIComponent(record.registrationNumber)}`}
                    className="rounded-control font-medium text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {record.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <StatusBadge status={record.publicationStatus} size="sm" />
                    {record.isAiArea ? <AiTag kind="area" /> : null}
                    {record.isAiUsage ? <AiTag kind="usage" /> : null}
                  </div>
                </td>
                <td className="max-w-[240px] px-4 py-3.5">
                  <span className="flex items-start gap-1.5 text-small text-secondary">
                    <Building2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                      aria-hidden
                    />
                    <span className="line-clamp-2">{record.organizationName}</span>
                  </span>
                </td>
                <td className="max-w-[220px] px-4 py-3.5">
                  <span className="line-clamp-2 text-small text-secondary">
                    {record.researchTypes.join(", ") || "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-small text-secondary">
                  {year}
                </td>
                <td className="px-4 py-3.5 text-meta text-muted">
                  {record.isAiArea || record.isAiUsage ? "да" : "—"}
                </td>
                <td className="max-w-[180px] px-4 py-3.5">
                  <ProvenanceBadge provenance={record.provenance} compact />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
