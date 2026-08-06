/**
 * T-006. Карточка результата реестра НИОКТР (мобильный стек / список).
 *
 * Структура по Design.md §12.2 «result detail» и STATES.md:
 *   - что это        — тип работ, рег. №, год;
 *   - почему важно   — аннотация (выжимка) и ключевые слова;
 *   - состояние      — статус публикации «Опубликовано» + метки ИИ;
 *   - следующее действие — «Открыть карточку»;
 *   - provenance     — источник «МИНОБРНАУКИ России» + дата импорта.
 *
 * Компонент серверный (без «use client»): только реальные записи
 * ResearchRecord, фикстуры в публичный реестр не попадают (адаптер T-004).
 */

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Cpu,
  Sparkles,
} from "lucide-react";
import type { ResearchRecord } from "@/lib/types.ts";
import { StatusBadge } from "@/components/status-badge.tsx";
import { ProvenanceBadge } from "./provenance-badge.tsx";

/** Метка тематики/использования ИИ на карточке. */
export function AiTag({
  kind,
}: {
  kind: "area" | "usage";
}) {
  const isArea = kind === "area";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-meta font-medium ${
        isArea
          ? "bg-accent-soft text-accent"
          : "bg-status-info-soft text-status-info"
      }`}
    >
      {isArea ? (
        <Cpu className="h-3 w-3" aria-hidden />
      ) : (
        <Sparkles className="h-3 w-3" aria-hidden />
      )}
      {isArea ? "Тематика ИИ" : "Использование ИИ"}
    </span>
  );
}

/** Год записи из createdDate (ISO YYYY-MM-DD). */
export function researchYear(record: ResearchRecord): string {
  return record.createdDate.slice(0, 4);
}

export function ResearchCard({ record }: { record: ResearchRecord }) {
  const year = researchYear(record);

  return (
    <article className="flex min-w-0 flex-col rounded-panel border border-subtle bg-surface p-5">
      {/* Состояние: рег. № + статус публикации */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-meta text-muted">
          {record.registrationNumber}
        </span>
        <StatusBadge status={record.publicationStatus} size="sm" />
      </div>

      {/* Что это: название */}
      <h3 className="mt-2.5 text-h3 font-semibold leading-snug tracking-tight text-primary">
        <Link
          href={`/research/${encodeURIComponent(record.registrationNumber)}`}
          className="rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {record.title}
        </Link>
      </h3>

      {/* Тип работ, год, ИИ-метки */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {record.researchTypes.slice(0, 2).map((type) => (
          <span
            key={type}
            className="inline-flex items-center rounded-[6px] bg-surface-elevated px-1.5 py-0.5 text-meta text-secondary"
          >
            {type}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-[6px] bg-surface-elevated px-1.5 py-0.5 text-meta text-secondary">
          <CalendarDays className="h-3 w-3" aria-hidden />
          {year}
        </span>
        {record.isAiArea ? <AiTag kind="area" /> : null}
        {record.isAiUsage ? <AiTag kind="usage" /> : null}
      </div>

      {/* Почему важно: аннотация */}
      <p className="mt-3 line-clamp-3 text-small leading-relaxed text-secondary">
        {record.annotation}
      </p>

      {/* Ключевые слова */}
      {record.keywords.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ключевые слова">
          {record.keywords.slice(0, 4).map((keyword) => (
            <li
              key={keyword}
              className="rounded-[6px] border border-subtle px-1.5 py-0.5 font-mono text-meta text-muted"
            >
              {keyword}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Исполнитель / заказчик */}
      <dl className="mt-4 space-y-1 text-small text-secondary">
        <div className="flex gap-2">
          <dt className="flex shrink-0 items-center gap-1 text-muted">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            Исполнитель
          </dt>
          <dd className="min-w-0">{record.organizationName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="flex shrink-0 items-center gap-1 text-muted">
            Заказчик
          </dt>
          <dd className="min-w-0">{record.customerName}</dd>
        </div>
      </dl>

      {/* Provenance + следующее действие */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3.5">
        <ProvenanceBadge provenance={record.provenance} compact />
        <Link
          href={`/research/${encodeURIComponent(record.registrationNumber)}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Открыть карточку
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
