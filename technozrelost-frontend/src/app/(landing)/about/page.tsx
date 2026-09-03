import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Landmark, Target, Users2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "О центре — Технозрелость",
  description:
    "Центр технологического развития Удмуртской Республики и цифровая платформа «Технозрелость»: миссия, нормативная база, что даёт платформа.",
};

export default async function AboutPage() {
  const t = await getTranslations("about");
  const POINTS = [
    {
      icon: Target,
      title: t("missionTitle"),
      text: t("missionText"),
    },
    {
      icon: BookOpen,
      title: t("legalTitle"),
      text: t("legalText"),
    },
    {
      icon: Users2,
      title: t("ecosystemTitle"),
      text: t("ecosystemText"),
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">{t("eyebrow")}</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">
          {t("title")}
        </h1>
        <p className="tz-lead mt-4 max-w-2xl">
          {t("lead")}
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <div className="tz-card h-full p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-tz-border bg-tz-soft text-tz-accent-hover">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="tz-card-title mt-4">{p.title}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-tz-secondary">{p.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-12 tz-card flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-tz-accent-hover" />
              <p className="tz-eyebrow">{t("whatGivesEyebrow")}</p>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-tz-secondary">
              {t("whatGivesText")}
            </p>
          </div>
          <Link href="/methodology" className="tz-btn tz-btn-primary">
            {t("methodology")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
