import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";
import { getUgtLevels } from "@/lib/ugt-data";
import { asTranslateFn } from "@/lib/types";

export const metadata: Metadata = {
  title: "Уровни УГТ 1–9 — Технозрелость",
  description:
    "Девять уровней готовности технологий по ГОСТ Р 58048-2017: от базовых принципов до промышленной эксплуатации.",
};

/** Цвет уровня из токенов темы (тёплые низкие → зелёные высокие). */
const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

export default async function LevelsPage() {
  const t = await getTranslations("levels");
  const levels = getUgtLevels(asTranslateFn(await getTranslations("ugt")));
  const plural = (n: number, one: string, few: string, many: string): string => {
    // Use translated words from t where possible, but keep logic for RU/EN
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">{t("eyebrow")}</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">{t("title")}</h1>
        <p className="tz-lead mt-4 max-w-2xl">
          {t("lead")}
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((lvl, i) => {
          const displayName = lvl.name;
          const displayShort = lvl.short;
          const displayCode = lvl.code;
          return (
          <Reveal key={lvl.id} delay={(i % 3) * 0.06}>
            <Link
              href={`/levels/${lvl.id}`}
              className="group flex h-full flex-col rounded-2xl border border-tz-border bg-tz-surface p-6 shadow-[0_4px_16px_rgba(11,13,18,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(11,13,18,0.12)]"
              style={{ ["--card-accent" as string]: ugtColor(lvl.id) }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] font-mono text-sm font-semibold text-white transition-transform duration-300 group-hover:scale-[1.08]"
                  style={{ background: ugtColor(lvl.id) }}
                >
                  {String(lvl.id).padStart(2, "0")}
                </div>
                <div className="flex-1">
                  <span className="font-mono text-sm font-medium" style={{ color: ugtColor(lvl.id) }}>
                    {displayCode}
                  </span>
                  <h2 className="mt-0.5 text-xl font-semibold leading-snug text-tz-fg">
                    {displayName}
                  </h2>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-tz-secondary">
                {displayShort}
              </p>

              <div className="my-4 h-px w-full bg-tz-border/60" />

              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs font-medium text-tz-muted">
                  <ListChecks size={14} />
                  {lvl.requirements.length}{" "}
                  {plural(lvl.requirements.length, t("requirement"), t("requirementsFew"), t("requirementsMany"))}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-tz-muted">
                  <FileText size={14} />
                  {lvl.deliverables.length}{" "}
                  {plural(lvl.deliverables.length, t("result"), t("resultsFew"), t("resultsMany"))}
                </span>
              </div>

              <div
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors"
                style={{ color: ugtColor(lvl.id) }}
              >
                {t("more")}
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </Reveal>
          );
        })}
      </div>
    </div>
  );
}
