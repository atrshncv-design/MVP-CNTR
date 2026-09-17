import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Landmark } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";
import { serverApiBase } from "@/lib/public-api";

export const dynamic = "force-dynamic";

interface NioktrBudget {
  funds?: string;
  budget_type?: string;
}

interface NioktrDetail {
  id: number;
  registration_number: string;
  name: string;
  annotation: string | null;
  keywords: string[];
  nioktr_types: string[];
  state_program: string | null;
  federal_program: string | null;
  created_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ai_area: boolean;
  is_ai_usage: boolean;
  executor_name: string | null;
  executor_short_name: string | null;
  executor_ogrn: string | null;
  executor_territory: string | null;
  customer_name: string | null;
  budgets: NioktrBudget[];
  organization_id: number | null;
}

const formatFunds = (funds: string | undefined): string => {
  if (!funds) return "—";
  const n = parseFloat(funds);
  if (Number.isNaN(n)) return funds;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
};

/**
 * Таск 03 (R01, истории 5–7): публичная деталка НИОКТР по регномеру.
 * Читает GET /nioktr/[regNumber] сервера анонимно (без Authorization,
 * ручка CurrentUserOptional); мусор — честная 404. Приватных полей нет.
 */
async function fetchNioktrDetail(regNumber: string): Promise<NioktrDetail | null> {
  let response: Response;
  try {
    response = await fetch(
      `${serverApiBase()}/api/v1/nioktr/${encodeURIComponent(regNumber)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
  } catch {
    throw new Error("nioktr-detail-unreachable");
  }
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error(`nioktr-detail-${response.status}`);
  return (await response.json()) as NioktrDetail;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regNumber: string }>;
}): Promise<Metadata> {
  const { regNumber } = await params;
  const t = await getTranslations("nioktr");
  const card = await fetchNioktrDetail(regNumber).catch(() => null);
  if (!card) return { title: t("detailCardNotFound") };
  return {
    title: card.name,
    description: card.annotation ?? card.name,
  };
}

export default async function NioktrDetailPage({
  params,
}: {
  params: Promise<{ regNumber: string }>;
}) {
  const { regNumber } = await params;
  let card: NioktrDetail | null = null;
  try {
    card = await fetchNioktrDetail(regNumber);
  } catch {
    const t = await getTranslations("nioktr");
    throw new Error(t("detailLoadError"));
  }
  if (!card) notFound();

  const t = await getTranslations("nioktr");
  const budgets = Array.isArray(card.budgets) ? card.budgets : [];

  return (
    <div className="mx-auto max-w-[1024px] px-6 py-16 md:py-24">
      <Reveal>
        <Link
          href="/nioktr"
          className="inline-flex items-center gap-2 text-sm text-tz-muted transition-colors hover:text-tz-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detailBackToRegistry")}
        </Link>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-tz-soft/70 px-3 py-1 font-mono text-xs font-medium text-tz-muted">
            {card.registration_number}
          </span>
          {card.is_ai_area && (
            <span className="rounded-full bg-tz-accent/10 px-3 py-1 text-[11px] font-semibold text-tz-accent">
              {t("detailAiBadge")}
            </span>
          )}
          {(card.nioktr_types ?? []).slice(0, 2).map((tp) => (
            <span
              key={tp}
              className="rounded-full bg-tz-soft/70 px-3 py-1 text-[11px] text-tz-muted"
            >
              {tp}
            </span>
          ))}
        </div>
        <h1 className="tz-page-title mt-4">{card.name}</h1>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-8 rounded-2xl border border-tz-border/60 bg-tz-surface p-6 sm:p-8">
          <h2 className="tz-card-title">{t("detailAnnotation")}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-tz-secondary">
            {card.annotation ?? t("detailAnnotationEmpty")}
          </p>
          {(card.keywords ?? []).length > 0 && (
            <div className="mt-6">
              <h2 className="tz-card-title">{t("detailKeywords")}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-tz-surface-2 px-2.5 py-0.5 text-xs text-tz-secondary"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Reveal>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Reveal delay={0.1}>
          <div className="tz-card h-full p-6">
            <h2 className="tz-card-title">{t("detailExecutor")}</h2>
            <p className="mt-2 flex items-start gap-2 text-sm text-tz-secondary">
              <Building2 size={15} className="mt-0.5 shrink-0 text-tz-muted" />
              {card.executor_short_name || card.executor_name || t("detailNotSpecified")}
            </p>
            {card.executor_ogrn && (
              <p className="mt-2 text-sm text-tz-secondary">
                {card.executor_ogrn ? (
                  <Link
                    href={`/customers/${encodeURIComponent(card.executor_ogrn)}`}
                    className="transition-colors hover:text-tz-accent"
                  >
                    {t("detailOgrn", { ogrn: card.executor_ogrn })}
                  </Link>
                ) : null}
              </p>
            )}
            {card.executor_territory && (
              <p className="mt-1 text-sm text-tz-muted">{card.executor_territory}</p>
            )}
            <h2 className="tz-card-title mt-6">{t("detailCustomer")}</h2>
            <p className="mt-2 flex items-start gap-2 text-sm text-tz-secondary">
              <Landmark size={15} className="mt-0.5 shrink-0 text-tz-muted" />
              {card.customer_name || t("detailNotSpecified")}
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="tz-card h-full p-6">
            <h2 className="tz-card-title">{t("detailDeadlines")}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-tz-secondary">
              <Calendar size={15} className="shrink-0 text-tz-muted" />
              {t("detailStart")} {card.start_date || t("detailNotSpecifiedDates")}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-tz-secondary">
              <Calendar size={15} className="shrink-0 text-tz-muted" />
              {t("detailEnd")} {card.end_date || t("detailNotSpecifiedDates")}
            </p>
            {card.is_ai_usage && (
              <p className="mt-4 rounded-xl bg-tz-accent/5 p-3 text-[12.5px] leading-relaxed text-tz-secondary">
                {t("detailAiUsage")}
              </p>
            )}
          </div>
        </Reveal>
      </div>

      {budgets.length > 0 && (
        <Reveal delay={0.14}>
          <div className="tz-card mt-6 p-6">
            <h2 className="tz-card-title">{t("detailFinancing")}</h2>
            <ul className="mt-3 space-y-2">
              {budgets.map((b, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border/60 bg-tz-soft/40 px-4 py-2.5 text-sm"
                >
                  <span className="text-tz-secondary">
                    {t("detailSource")}: {b.budget_type || t("detailNotSpecified")}
                  </span>
                  <span className="font-mono font-semibold text-tz-fg">
                    {t("detailAmount")}: {formatFunds(b.funds)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}
    </div>
  );
}
