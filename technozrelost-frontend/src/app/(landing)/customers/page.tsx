import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Landmark, Factory, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Заказчикам — Технозрелость",
  description:
    "Кому платформа «Технозрелость» помогает как заказчику: госкомпаниям, научным организациям, инвесторам, региональным ведомствам.",
};

export default async function CustomersPage() {
  const t = await getTranslations("customers");
  const CUSTOMERS = [
    {
      icon: Building2,
      title: t("card1Title"),
      text: t("card1Text"),
      points: [t("card1p1"), t("card1p2"), t("card1p3")],
    },
    {
      icon: Landmark,
      title: t("card2Title"),
      text: t("card2Text"),
      points: [t("card2p1"), t("card2p2"), t("card2p3")],
    },
    {
      icon: Factory,
      title: t("card3Title"),
      text: t("card3Text"),
      points: [t("card3p1"), t("card3p2"), t("card3p3")],
    },
    {
      icon: TrendingUp,
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

      <div className="mt-12 space-y-5">
        {CUSTOMERS.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.05}>
            <div className="tz-card tz-card-hover grid gap-6 p-7 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-tz-border bg-tz-soft text-tz-accent-hover">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <h2 className="tz-card-title">{c.title}</h2>
                </div>
                <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-tz-secondary">
                  {c.text}
                </p>
              </div>
              <ul className="flex flex-col justify-center gap-2">
                {c.points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2 rounded-lg border border-tz-border/60 bg-tz-soft/50 px-3 py-1.5 text-[12.5px] text-tz-secondary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-tz-accent-hover" />
                    {p}
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
            {t("register")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/levels" className="tz-btn tz-btn-secondary">
            {t("viewLevels")}
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
