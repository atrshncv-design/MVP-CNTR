/**
 * T-006. Детальная карточка НИОКТР (/research/[id]).
 *
 * РЕАЛЬНАЯ запись из реестра (getResearch, scope=public). Если записи нет —
 * notFound() → публичный not-found. Provenance-блок: источник
 * «МИНОБРНАУКИ России» и дата импорта. Поля показываются как есть:
 * отсутствующие (stateProgram, region) — честно «не указано», не фабрикуются.
 */

import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Database,
  FileText,
} from "lucide-react";
import { getAdapter } from "@/lib/adapter/index.ts";
import type { ResearchRecord } from "@/lib/types.ts";
import { formatDate } from "@/lib/datetime.ts";
import { StatusBadge } from "@/components/status-badge.tsx";
import { LoadingSkeleton } from "@/components/states/loading-skeleton.tsx";
import { AiTag, researchYear } from "@/components/registry/result-card.tsx";

export const metadata: Metadata = {
  title: "Карточка НИОКТР — ЦНТР Удмуртии",
  description: "Детальная карточка научно-исследовательской работы из реестра НИОКТР.",
};

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const registrationNumber = decodeURIComponent(id);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-16">
      <Link
        href="/research"
        className="inline-flex h-10 items-center gap-1.5 rounded-control px-2 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        К реестру НИОКТР
      </Link>

      <Suspense
        fallback={
          <div className="mt-6">
            <LoadingSkeleton variant="detail" label="Загружаем карточку НИОКТР" />
          </div>
        }
      >
        <ResearchDetail registrationNumber={registrationNumber} />
      </Suspense>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-meta font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-small leading-relaxed text-primary">{value}</dd>
    </div>
  );
}

async function ResearchDetail({
  registrationNumber,
}: {
  registrationNumber: string;
}) {
  const adapter = getAdapter();
  let record: ResearchRecord | null;
  try {
    record = await adapter.getResearch(registrationNumber, "public");
  } catch {
    record = null;
  }
  if (!record) notFound();

  const year = researchYear(record);
  const region = record.region;

  return (
    <article className="mt-8">
      {/* Состояние: рег. №, статус, ИИ-метки */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-[6px] bg-surface-elevated px-2 py-1 font-mono text-meta text-secondary">
          {record.registrationNumber}
        </span>
        <StatusBadge status={record.publicationStatus} size="sm" />
        {record.isAiArea ? <AiTag kind="area" /> : null}
        {record.isAiUsage ? <AiTag kind="usage" /> : null}
      </div>

      <h1 className="mt-4 max-w-4xl text-h1 font-semibold tracking-tight text-primary">
        {record.title}
      </h1>

      {/* Аннотация */}
      <section className="mt-8 max-w-3xl" aria-label="Аннотация">
        <h2 className="text-h3 font-semibold tracking-tight text-primary">
          Аннотация
        </h2>
        <p className="mt-3 whitespace-pre-line text-body leading-relaxed text-secondary">
          {record.annotation}
        </p>
      </section>

      {/* Параметры работы */}
      <section
        className="mt-10 max-w-3xl rounded-panel border border-subtle bg-surface p-6"
        aria-label="Параметры работы"
      >
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <MetaRow
            label="Исполнитель"
            value={
              region
                ? `${record.organizationName} · ${region}`
                : record.organizationName
            }
          />
          <MetaRow label="Заказчик" value={record.customerName} />
          <MetaRow label="Дата создания" value={formatDate(record.createdDate) || record.createdDate} />
          <MetaRow label="Год" value={year} />
          <div className="sm:col-span-2">
            <dt className="text-meta font-medium uppercase tracking-wide text-muted">
              Тип работ
            </dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {record.researchTypes.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 rounded-[6px] bg-surface-elevated px-2 py-1 text-small text-secondary"
                >
                  <FileText className="h-3.5 w-3.5 text-muted" aria-hidden />
                  {type}
                </span>
              ))}
            </dd>
          </div>
          <MetaRow
            label="Государственная программа"
            value={record.stateProgram ?? "Не указана"}
          />
          <MetaRow
            label="Регион исполнителя"
            value={region ?? "Не указан"}
          />
        </dl>
      </section>

      {/* Ключевые слова */}
      {record.keywords.length > 0 ? (
        <section className="mt-10 max-w-3xl" aria-label="Ключевые слова">
          <h2 className="text-h3 font-semibold tracking-tight text-primary">
            Ключевые слова
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {record.keywords.map((keyword) => (
              <li
                key={keyword}
                className="rounded-[6px] border border-subtle bg-surface px-2.5 py-1.5 font-mono text-small text-secondary"
              >
                {keyword}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Provenance */}
      <section
        className="mt-10 max-w-3xl rounded-panel border border-subtle bg-surface p-6"
        aria-label="Источник данных"
      >
        <div className="flex flex-wrap items-start gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-elevated text-muted"
            aria-hidden
          >
            <Database className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-small font-semibold text-primary">
              Источник данных
            </h2>
            <p className="mt-1 text-small leading-relaxed text-secondary">
              Карточка загружена из открытого реестра{" "}
              <strong className="font-medium text-primary">
                {record.provenance.source}
              </strong>
              {record.provenance.importedAt ? (
                <>
                  , импортировано{" "}
                  {formatDate(record.provenance.importedAt)}.
                </>
              ) : (
                "."
              )}{" "}
              Номер регистрации сохранён из исходных данных.
            </p>
          </div>
        </div>
      </section>

      {/* Следующие действия */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href="/register"
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
          Представить технологию
        </Link>
        <Link
          href="/research"
          className="inline-flex h-11 items-center gap-2 rounded-control border border-strong px-5 text-small font-medium text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <Building2 className="h-4 w-4 text-muted" aria-hidden />
          В реестр НИОКТР
        </Link>
      </div>
    </article>
  );
}
