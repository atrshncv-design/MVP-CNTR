import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical, Factory, Landmark, Rocket } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Исполнителям — Технозрелость",
  description:
    "Кому платформа «Технозрелость» помогает как исполнителю: R&D-организациям, серийным производителям, регулирующим организациям, инженерным командам.",
};

export default async function PerformersPage() {
  const t = await getTranslations("performers");
  const PERFORMERS = [
    {
      icon: FlaskConical,
      title: t("card1Title"),
      text: t("card1Text"),
      points: [t("card1p1"), t("card1p2"), t("card1p3")],
    },
    {
      icon: Factory,
      title: t("card2Title"),
      text: t("card2Text"),
      points: [t("card2p1"), t("card2p2"), t("card2p3")],
    },
    {
      icon: Landmark,
      title: t("card3Title"),
      text: t("card3Text"),
      points: [t("card3p1"), t("card3p2"), t("card3p3")],
    },
    {
      icon: Rocket,
      title: t("card4Title"),
      text: t("card4Text"),
      points: [t("card4p1"), t("card4p2"), t("card4p3")],
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

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {PERFORMERS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.06}>
            <div className="tz-card tz-card-hover h-full p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg tz-grad-bg text-white">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="tz-card-title mt-4">{p.title}</h2>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-tz-secondary">{p.text}</p>
              <ul className="mt-4 space-y-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2 text-[12.5px] text-tz-secondary">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tz-accent-hover" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/register" className="tz-btn tz-btn-primary">
            {t("startProject")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/methodology" className="tz-btn tz-btn-secondary">
            {t("methodology")}
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
