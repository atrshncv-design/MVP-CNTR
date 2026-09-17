import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";
import ProjectRadar from "@/components/dashboard/project-radar";
import { serverApiBase } from "@/lib/public-api";
import { getStatusColor, getStatusLabelT } from "@/lib/status";
import { asTranslateFn, type RegistryProjectOut } from "@/lib/types";

export const dynamic = "force-dynamic";

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

/**
 * Таск 03 (R01, истории 5–7): публичная деталка проекта реестра.
 * Читает GET /projects/registry/[id] сервера анонимно (без Authorization,
 * ручка CurrentUserOptional); приватный/несуществующий id — честная 404.
 * Приватных полей и действий на странице нет.
 */
async function fetchProjectDetail(id: string): Promise<RegistryProjectOut | null> {
  let response: Response;
  try {
    response = await fetch(
      `${serverApiBase()}/api/v1/projects/registry/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
  } catch {
    throw new Error("registry-detail-unreachable");
  }
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error(`registry-detail-${response.status}`);
  return (await response.json()) as RegistryProjectOut;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("projectsLanding");
  const item = await fetchProjectDetail(id).catch(() => null);
  if (!item) return { title: t("nothingFound") };
  return {
    title: item.name,
    description: item.description ?? item.name,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let item: RegistryProjectOut | null = null;
  try {
    item = await fetchProjectDetail(id);
  } catch {
    const t = await getTranslations("projectsLanding");
    throw new Error(t("loadError"));
  }
  if (!item) notFound();

  const t = await getTranslations("projectsLanding");
  const tCommon = await getTranslations("common");
  const tUgt = await getTranslations("ugtData");
  const tLanding = await getTranslations("landing");
  const color = ugtColor(item.current_level);
  let codeLabel: string;
  try {
    codeLabel = tUgt(`code${item.current_level}`);
  } catch {
    codeLabel = tLanding("ugtBadge", { level: item.current_level });
  }
  const formatBudget = (budget: number | null) => {
    if (budget == null) return t("budgetNotSpecified");
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(budget);
  };

  return (
    <div className="mx-auto max-w-[1024px] px-6 py-16 md:py-24">
      <Reveal>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-tz-muted transition-colors hover:text-tz-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon("back")}
        </Link>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 font-mono text-xs font-semibold"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {codeLabel}
          </span>
          {item.category && (
            <span className="rounded-full bg-tz-soft/70 px-3 py-1 font-mono text-xs font-medium text-tz-muted">
              {item.category}
            </span>
          )}
          {item.status && (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: `${getStatusColor(item.status)}14`,
                color: getStatusColor(item.status),
              }}
            >
              {getStatusLabelT(asTranslateFn(tCommon), item.status)}
            </span>
          )}
        </div>
        <h1 className="tz-page-title mt-4">{item.name}</h1>
        {item.organization && (
          <p className="mt-2 text-sm text-tz-muted">{item.organization}</p>
        )}
      </Reveal>

      <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
        <Reveal delay={0.08}>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-tz-border/60 bg-tz-soft/40 p-5">
            <ProjectRadar currentLevel={item.current_level} documents={[]} size={200} />
            <p className="text-center text-[11.5px] leading-relaxed text-tz-muted">
              {t("radarCaption")}
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            {item.description && (
              <p className="text-[15px] leading-relaxed text-tz-secondary">
                {item.description}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                  {t("level")}
                </p>
                <p className="mt-1 font-mono text-lg font-bold" style={{ color }}>
                  {item.current_level} {t("outOf")}
                </p>
              </div>
              <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                  {t("budget")}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-tz-fg">
                  {formatBudget(item.budget)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {item.category && (
                <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                    {t("category")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-tz-fg">{item.category}</p>
                </div>
              )}
              {item.organization && (
                <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                    {t("organization")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-tz-fg">{item.organization}</p>
                </div>
              )}
            </div>
            <div className="mt-6 rounded-xl border border-tz-border/60 bg-tz-accent/5 p-4">
              <p className="text-[12.5px] leading-relaxed text-tz-secondary">
                {t("fullData")}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
