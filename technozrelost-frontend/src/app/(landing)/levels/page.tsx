import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, ListChecks } from "lucide-react";
import Reveal from "@/components/landing/reveal";
import { UGT_LEVELS } from "@/lib/ugt-data";

export const metadata: Metadata = {
  title: "Уровни УГТ 1–9 — Технозрелость",
  description:
    "Девять уровней готовности технологий по ГОСТ Р 58048-2017: от базовых принципов до промышленной эксплуатации.",
};

/** Цвет уровня из токенов темы (тёплые низкие → зелёные высокие). */
const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

/** Склонение по числу: 1 → one, 2–4 → few, 5+ → many. */
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export default function LevelsPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">Методика · ГОСТ Р 58048-2017</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">Уровни готовности технологий 1–9</h1>
        <p className="tz-lead mt-4 max-w-2xl">
          Каждый уровень описывает проверяемый результат: что должно быть сделано,
          какие документы и доказательства собраны. Переход на следующий уровень
          возможен только при выполнении требований текущего.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {UGT_LEVELS.map((lvl, i) => (
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
                    {lvl.code}
                  </span>
                  <h2 className="mt-0.5 text-xl font-semibold leading-snug text-tz-fg">
                    {lvl.name}
                  </h2>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-tz-secondary">
                {lvl.short}
              </p>

              <div className="my-4 h-px w-full bg-tz-border/60" />

              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs font-medium text-tz-muted">
                  <ListChecks size={14} />
                  {lvl.requirements.length}{" "}
                  {plural(lvl.requirements.length, "требование", "требования", "требований")}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-tz-muted">
                  <FileText size={14} />
                  {lvl.deliverables.length}{" "}
                  {plural(lvl.deliverables.length, "результат", "результата", "результатов")}
                </span>
              </div>

              <div
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors"
                style={{ color: ugtColor(lvl.id) }}
              >
                Подробнее
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
