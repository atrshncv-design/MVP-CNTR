import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Home, ArrowLeft, ArrowRight } from "lucide-react";
import { UGT_LEVELS, type UGTLevel } from "@/lib/ugt-data";
import LevelDetailInteractive from "@/components/landing/level-detail";

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

export function generateStaticParams() {
  return UGT_LEVELS.map((lvl) => ({ id: String(lvl.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lvl = UGT_LEVELS.find((l) => String(l.id) === id);
  if (!lvl) return { title: "Уровень не найден — Технозрелость" };
  return {
    title: `УГТ ${lvl.id} — ${lvl.name} — Технозрелость`,
    description: lvl.short,
  };
}

function getStageLabel(id: number): string {
  if (id <= 2) return "Исследование";
  if (id <= 4) return "Подтверждение концепции";
  if (id <= 6) return "Прототипирование";
  if (id === 7) return "Полевые испытания";
  if (id === 8) return "Квалификация";
  return "Эксплуатация";
}

function LevelDetail({ level }: { level: UGTLevel }) {
  const prev = UGT_LEVELS.find((l) => l.id === level.id - 1);
  const next = UGT_LEVELS.find((l) => l.id === level.id + 1);
  const color = ugtColor(level.id);

  return (
    <>
      {/* ═══ Hero: градиент цвета уровня ═══ */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${color}18 0%, ${color}08 50%, var(--tz-bg) 100%)`,
          borderBottom: `3px solid ${color}`,
        }}
      >
        {/* Радиальные пятна-свечения */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 20% 40%, ${color}14 0%, transparent 60%),
                         radial-gradient(ellipse 60% 80% at 80% 20%, ${color}0d 0%, transparent 50%)`,
          }}
        />

        <div className="relative mx-auto max-w-[1280px] px-4 pt-14 pb-12 sm:px-6 sm:pb-16 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-tz-muted">
            <Link href="/" className="flex items-center gap-1 transition-colors hover:text-tz-accent">
              <Home size={14} />
              <span>Главная</span>
            </Link>
            <ChevronRight size={14} />
            <Link href="/levels" className="transition-colors hover:text-tz-accent">
              Уровни УГТ
            </Link>
            <ChevronRight size={14} />
            <span className="font-medium" style={{ color }}>
              {level.code}
            </span>
          </nav>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            {/* Основная информация */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-block rounded-full px-4 py-1.5 font-mono text-base font-semibold"
                  style={{
                    background: `${color}18`,
                    color,
                    border: `1px solid ${color}40`,
                    boxShadow: `0 2px 8px ${color}15`,
                  }}
                >
                  {level.code}
                </span>
                <span className="rounded-full bg-tz-surface/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-tz-muted">
                  {getStageLabel(level.id)}
                </span>
              </div>

              <h1
                className="tz-page-title mt-5"
                style={{ letterSpacing: "-0.02em", lineHeight: 1.12 }}
              >
                {level.name}
              </h1>

              <p className="mt-4 max-w-[700px] text-lg font-medium leading-relaxed text-tz-fg">
                {level.short}
              </p>
              <p className="mt-4 max-w-[700px] text-base leading-relaxed text-tz-secondary">
                {level.description}
              </p>
            </div>

            {/* Prev/Next навигация */}
            <div className="flex flex-col gap-3 lg:w-[240px]">
              {prev && (
                <Link
                  href={`/levels/${prev.id}`}
                  className="group block rounded-2xl border border-tz-border/60 bg-tz-surface p-4 transition-all duration-200 hover:-translate-x-1 hover:shadow-lg"
                  style={{ boxShadow: "0 4px 20px rgba(11,13,18,0.06)" }}
                >
                  <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.06em] text-tz-muted">
                    <ArrowLeft size={12} /> Предыдущий
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-tz-fg">
                    {prev.code}: {prev.name}
                  </span>
                </Link>
              )}
              {next && (
                <Link
                  href={`/levels/${next.id}`}
                  className="group block rounded-2xl border border-tz-border/60 bg-tz-surface p-4 transition-all duration-200 hover:translate-x-1 hover:shadow-lg"
                  style={{ boxShadow: "0 4px 20px rgba(11,13,18,0.06)" }}
                >
                  <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.06em] text-tz-muted">
                    Следующий <ArrowRight size={12} />
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-tz-fg">
                    {next.code}: {next.name}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Интерактивные секции: таймлайн, чек-лист, переход, KPI, документы, риски */}
      <LevelDetailInteractive level={level} />
    </>
  );
}

export default async function LevelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const level = UGT_LEVELS.find((l) => String(l.id) === id);
  if (!level) notFound();
  return <LevelDetail level={level} />;
}
