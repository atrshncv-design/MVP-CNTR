import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/landing/reveal";
import { UGT_LEVELS } from "@/lib/ugt-data";
import { ugtTone, ugtToneClass } from "@/components/landing/ugt-card";

export const metadata: Metadata = {
  title: "Уровни УГТ 1–9 — Технозрелость",
  description:
    "Девять уровней готовности технологий по ГОСТ Р 58048-2017: от базовых принципов до промышленной эксплуатации.",
};

export default function LevelsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Reveal>
        <p className="tz-eyebrow">Методика · ГОСТ Р 58048-2017</p>
        <h1 className="mt-3 max-w-2xl tz-page-title">Уровни готовности технологий 1–9</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-tz-secondary">
          Каждый уровень описывает проверяемый результат: что должно быть сделано,
          какие документы и доказательства собраны. Переход на следующий уровень
          возможен только при выполнении требований текущего.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {UGT_LEVELS.map((lvl, i) => (
          <Reveal key={lvl.id} delay={(i % 3) * 0.06}>
            <Link
              href={`/levels/${lvl.id}`}
              className="tz-card tz-card-hover group flex h-full flex-col p-6"
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-2xl font-extrabold tracking-tight"
                  style={{ color: ugtTone(lvl.id) }}
                >
                  {lvl.id}
                </span>
                <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${ugtToneClass(lvl.id)}`}>
                  {lvl.id <= 3 ? "низкая" : lvl.id <= 6 ? "средняя" : "высокая"}
                </span>
              </div>
              <h2 className="mt-3 font-display text-[16px] font-bold leading-snug text-tz-fg">
                {lvl.name}
              </h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-tz-secondary">
                {lvl.short}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-tz-border/60 pt-3">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-tz-muted">
                  {lvl.requirements.length} критериев · {lvl.deliverables.length} документов
                </span>
                <ArrowRight className="h-4 w-4 text-tz-muted transition-transform group-hover:translate-x-0.5 group-hover:text-tz-fg" />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
