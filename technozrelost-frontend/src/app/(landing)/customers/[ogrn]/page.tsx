import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";
import { serverApiBase } from "@/lib/public-api";

export const dynamic = "force-dynamic";

interface OrgNioktrCard {
  id: number;
  registration_number: string;
  name: string;
  annotation: string | null;
}

interface OrgDetail {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  org_type: string | null;
  competencies: string[];
  projects_count: number;
  region: string | null;
  nioktr_cards: OrgNioktrCard[];
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/**
 * Таск 03 (R01, истории 5–7): публичная деталка организации по ОГРН.
 * Читает GET /nioktr/organizations/[ogrn] сервера анонимно (без
 * Authorization, ручка CurrentUserOptional); мусор — честная 404.
 * Приватных полей и действий на странице нет.
 */
async function fetchOrgDetail(ogrn: string): Promise<OrgDetail | null> {
  let response: Response;
  try {
    response = await fetch(
      `${serverApiBase()}/api/v1/nioktr/organizations/${encodeURIComponent(ogrn)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
  } catch {
    throw new Error("org-detail-unreachable");
  }
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error(`org-detail-${response.status}`);
  return (await response.json()) as OrgDetail;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ogrn: string }>;
}): Promise<Metadata> {
  const { ogrn } = await params;
  const t = await getTranslations("executors");
  const org = await fetchOrgDetail(ogrn).catch(() => null);
  if (!org) return { title: t("emptyTitle") };
  return {
    title: org.short_name || org.name,
    description: org.name,
  };
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ ogrn: string }>;
}) {
  const { ogrn } = await params;
  let org: OrgDetail | null = null;
  try {
    org = await fetchOrgDetail(ogrn);
  } catch {
    const t = await getTranslations("executors");
    throw new Error(t("errorLoad"));
  }
  if (!org) notFound();

  const t = await getTranslations("executors");
  const tCommon = await getTranslations("common");
  const tNioktr = await getTranslations("nioktr");
  const cards = Array.isArray(org.nioktr_cards) ? org.nioktr_cards : [];
  const competencies = Array.isArray(org.competencies) ? org.competencies : [];

  return (
    <div className="mx-auto max-w-[1024px] px-6 py-16 md:py-24">
      <Reveal>
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-sm text-tz-muted transition-colors hover:text-tz-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon("back")}
        </Link>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-6 flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-tz-accent/10 text-tz-accent">
            <Building2 size={26} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-2.5 py-0.5 text-xs font-medium text-tz-accent">
                <Building2 size={12} />
                {t("badgeOrganization")}
              </span>
              {org.region && (
                <span className="rounded-full bg-tz-soft/70 px-2.5 py-0.5 text-xs text-tz-muted">
                  {org.region}
                </span>
              )}
            </div>
            <h1 className="tz-page-title mt-3">{org.short_name || org.name}</h1>
            {org.short_name && org.name !== org.short_name && (
              <p className="mt-1 text-sm text-tz-muted">{org.name}</p>
            )}
            <p className="mt-2 text-sm text-tz-muted">
              {org.projects_count}{" "}
              {pluralize(org.projects_count, t("projectOne"), t("projectFew"), t("projectMany"))}
            </p>
          </div>
        </div>
      </Reveal>

      {competencies.length > 0 && (
        <Reveal delay={0.08}>
          <div className="tz-card mt-8 p-6">
            <h2 className="tz-card-title">{t("competencies")}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {competencies.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-tz-surface-2 px-2.5 py-0.5 text-xs text-tz-secondary"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <h2 className="tz-section-title mt-10">{tNioktr("title")}</h2>
      </Reveal>
      {cards.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {cards.map((card, i) => (
            <Reveal key={card.id} delay={(i % 2) * 0.06}>
              <Link
                href={`/nioktr/${encodeURIComponent(card.registration_number)}`}
                className="tz-card tz-card-hover flex h-full flex-col gap-3 p-5"
              >
                <span className="flex items-center gap-2 text-[11px] text-tz-muted">
                  <FlaskConical size={13} aria-hidden="true" />
                  <span className="font-mono">{card.registration_number}</span>
                </span>
                <span className="tz-card-title leading-snug">{card.name}</span>
                {card.annotation && (
                  <span className="flex-1 text-[13px] leading-relaxed text-tz-secondary">
                    {card.annotation}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-tz-accent">
                  {tCommon("open")} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal delay={0.1}>
          <div className="mt-6 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-12 text-center">
            <FlaskConical size={28} className="mx-auto text-tz-muted/60" />
            <p className="mt-3 text-sm text-tz-muted">{tNioktr("emptyTitle")}</p>
          </div>
        </Reveal>
      )}
    </div>
  );
}
