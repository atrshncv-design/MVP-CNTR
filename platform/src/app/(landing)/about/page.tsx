import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Landmark, Target, Users2 } from "lucide-react";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "О центре — Технозрелость",
  description:
    "Центр технологического развития Удмуртской Республики и цифровая платформа «Технозрелость»: миссия, нормативная база, что даёт платформа.",
};

const POINTS = [
  {
    icon: Target,
    title: "Миссия Центра",
    text: "Центр технологического развития Удмуртской Республики помогает региональным компаниям, научным организациям и инвесторам доводить технологии до промышленного применения — от научной идеи до серийного производства.",
  },
  {
    icon: BookOpen,
    title: "Нормативная база",
    text: "Оценка готовности технологий ведётся по ГОСТ Р 58048-2017 «Управление технологическим развитием. Оценка уровней готовности технологий». Платформа опирается на пакет методических ГОСТов и материалов концепции Центра НТР.",
  },
  {
    icon: Users2,
    title: "Экосистема",
    text: "Заказчики, R&D-исполнители, научные организации, серийные производители, регулирующие организации, инвесторы, аудиторы и команда Центра работают в едином контуре: один проект — одна карточка, общие реестры, прозрачные решения.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Reveal>
        <p className="tz-eyebrow">О центре</p>
        <h1 className="mt-3 max-w-2xl tz-page-title">
          Центр технологического развития Удмуртской Республики
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-tz-secondary">
          «Технозрелость» — цифровая платформа Центра НТР УР. Она переводит оценку
          технологической зрелости из разрозненных экспертных практик в прозрачный
          стандартизированный процесс: каждая технология получает уровень по ГОСТ
          Р 58048-2017, а решение о готовности к внедрению принимается на основании
          документов, а не мнений.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <div className="tz-card h-full p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-tz-border bg-tz-soft text-tz-accent-hover">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-[15px] font-bold text-tz-fg">{p.title}</h2>
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
              <p className="tz-eyebrow">Что даёт платформа</p>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-tz-secondary">
              Заказчикам — оценку зрелости разработок перед закупкой; разработчикам —
              понятный путь роста УГТ с документами каждого этапа; инвесторам — реестр
              технологий УГТ 7+; региону — единую картину технологического потенциала.
            </p>
          </div>
          <Link href="/methodology" className="tz-btn tz-btn-primary">
            Методика оценки <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
