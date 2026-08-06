import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Дорожная карта — Технозрелость",
  description:
    "Дорожная карта платформы «Технозрелость»: от рабочего MVP до пилотных проектов и промышленной эксплуатации.",
};

const STAGES = [
  {
    status: "done" as const,
    period: "07.2026 — 08.2026",
    title: "MVP1 — рабочая платформа",
    text: "Ядро платформы: 9 рабочих личных кабинетов, экспресс-оценка УГТ, очереди менеджера ЦНТР, автозаявки N→N+1, реестры проектов и технологий, генерация документов, AI-ассистент по ГОСТам. Сдача — 31.08.2026.",
  },
  {
    status: "next" as const,
    period: "09.2026",
    title: "Пилотные проекты",
    text: "Запуск первых реальных проектов региона на платформе: регистрация команд, экспресс-оценки, верификация переходов и наполнение реестра технологий УГТ 7+.",
  },
  {
    status: "next" as const,
    period: "09.2026 — 10.2026",
    title: "Верификация словаря этапов методологами",
    text: "Словарь документов этапов, сгенерированный по ГОСТам, проходит экспертную верификацию методологов Центра — требования каждого перехода N→N+1 фиксируются как стандарт платформы.",
  },
  {
    status: "next" as const,
    period: "10.2026",
    title: "Продуктивный деплой",
    text: "Развёртывание на серверах организации: production-стек, HTTPS, резервное копирование, эксплуатационная документация.",
  },
  {
    status: "next" as const,
    period: "11.2026+",
    title: "Развитие экосистемы",
    text: "Наполнение реестров НИОКТР и организаций, расширение методической базы, подключение новых категорий участников и интеграция с региональными программами поддержки технологий.",
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <Reveal>
        <p className="tz-eyebrow">Развитие</p>
        <h1 className="mt-3 tz-page-title">Дорожная карта платформы</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-tz-secondary">
          Платформа развивается вместе с Центром: от рабочего MVP к пилотным проектам
          и промышленной эксплуатации.
        </p>
      </Reveal>

      <div className="mt-12 space-y-0">
        {STAGES.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.05}>
            <div className="relative flex gap-5 pb-10">
              {/* Линия */}
              {i < STAGES.length - 1 && (
                <span className="absolute left-[15px] top-9 h-full w-px bg-tz-border/70" />
              )}
              <span className="relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-tz-border bg-tz-surface">
                {s.status === "done" ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-tz-success" />
                ) : (
                  <Circle className="h-3 w-3 text-tz-muted" />
                )}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-[15.5px] font-bold text-tz-fg">{s.title}</h2>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-tz-muted">
                    {s.period}
                  </span>
                  {s.status === "done" && (
                    <span className="tz-badge tz-badge-success">готово</span>
                  )}
                </div>
                <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-tz-secondary">
                  {s.text}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/register" className="tz-btn tz-btn-primary">
            Присоединиться к платформе <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/about" className="tz-btn tz-btn-secondary">
            О центре
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
