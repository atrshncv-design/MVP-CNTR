import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  ClipboardCheck,
  Route,
  ShieldCheck,
} from "lucide-react";
import Reveal from "@/components/landing/reveal";
import UGTInteractiveScale from "@/components/landing/ugt-interactive-scale";
import { SHOWCASE_PROJECTS } from "@/lib/showcase";

export const metadata: Metadata = {
  title: "Технозрелость — цифровая платформа трансфера технологий ЦНТР УР",
  description:
    "Оценивайте уровень готовности технологий (УГТ) по ГОСТ Р 58048-2017, ведите проекты уровнями N→N+1 и доводите разработки до серийного производства.",
};

const STEPS = [
  {
    n: "01",
    icon: ClipboardCheck,
    title: "Экспресс-оценка",
    text: "Пройдите визард из 9 уровней по 4 категориям готовности — научной, технической, организационной и производственной. Получите предварительный УГТ и радар зрелости.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Верификация Центра",
    text: "Менеджер ЦНТР проверяет черновик, присваивает официальный УГТ и публикует проект в общем реестре платформы.",
  },
  {
    n: "03",
    icon: Route,
    title: "Рост уровня N→N+1",
    text: "Загружайте документы этапа — по полноте комплекта платформа автоматически сформирует заявку на повышение. Доведите технологию до УГТ 7+ и реестра технологий.",
  },
];

export default function LandingHome() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative flex items-center overflow-hidden" style={{ minHeight: "100vh" }}>
        {/* Фоновое видео (инновационная подложка, фокус слева) */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
        {/* Градиент слева для читаемости текста */}
        <div className="absolute inset-0 bg-gradient-to-l from-tz-bg via-tz-bg/85 to-tz-bg/10" />
        {/* Удмуртский орнамент-паттерн (overlay) */}
        <div className="tz-ornament-pattern pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 py-20">
          <div className="ml-auto max-w-2xl">
            <Reveal>
              <p className="tz-eyebrow">ЦНТР Удмуртии · Цифровая платформа трансфера технологий</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="tz-hero-title mt-4">
                Путь технологии от идеи до серийного производства —{" "}
                <span className="whitespace-nowrap tz-grad-text">на одной платформе</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-8 text-[15.5px] leading-relaxed text-tz-secondary">
                «Технозрелость» — цифровая инфраструктура Центра технологического развития
                Удмуртской Республики. Оценивайте уровень готовности технологий (УГТ) по
                ГОСТ Р 58048-2017, ведите проект уровнями N→N+1 и доводите разработку до
                внедрения — с верификацией Центра и живыми реестрами.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="tz-btn tz-btn-primary tz-btn-lg">
                  Оценить УГТ своего проекта
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="tz-btn tz-btn-secondary tz-btn-lg">
                  Войти
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Тёплая шкала УГТ ─────────────────────────────────────── */}
      <section className="mx-auto max-w-[1280px] px-6 pt-8 pb-16 md:pt-12 md:pb-24">
        <Reveal>
          <div className="flex items-center justify-between gap-4">
            <h2 className="tz-section-title">Уровни готовности технологий 1–9</h2>
            <Link href="/levels" className="tz-btn tz-btn-ghost tz-btn-sm">
              Подробнее <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-[13.5px] text-tz-muted">
            От базовых научных принципов до промышленной эксплуатации. Низкие уровни —
            тёплые, высокие — холодные.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-14">
            <UGTInteractiveScale />
          </div>
        </Reveal>
      </section>

      {/* ── Как это работает ─────────────────────────────────────── */}
      <section className="border-y border-tz-border/60 bg-tz-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="tz-eyebrow">Как это работает</p>
            <h2 className="mt-3 max-w-xl tz-page-title">
              Три шага от оценки до внедрения
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="tz-card h-full p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl tz-grad-bg text-white">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-2xl font-bold text-tz-muted/40">{s.n}</span>
                  </div>
                  <h3 className="mt-5 font-display text-[16px] font-bold text-tz-fg">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-tz-secondary">
                    {s.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Витрина проектов (тизер) ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="tz-eyebrow">Реестр платформы</p>
              <h2 className="mt-3 max-w-xl tz-page-title">Проекты, которые уже проходят оценку</h2>
            </div>
            <Link href="/projects" className="tz-btn tz-btn-ghost tz-btn-sm">
              Вся витрина <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_PROJECTS.slice(0, 3).map((p, i) => (
            <Reveal key={p.id} delay={i * 0.06}>
              <div className="tz-card tz-card-hover flex h-full flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold"
                    style={{
                      backgroundColor: `var(--tz-ugt-${p.current_level})18`,
                      color: `var(--tz-ugt-${p.current_level})`,
                    }}
                  >
                    УГТ {p.current_level}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-tz-muted">
                    {p.category}
                  </span>
                </div>
                <h3 className="tz-card-title mt-3 leading-snug">{p.name}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-tz-secondary">
                  {p.description}
                </p>
                <p className="mt-3 border-t border-tz-border/60 pt-3 text-[11.5px] text-tz-muted">
                  {p.region} · {p.org}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Финальный CTA ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl tz-grad-bg p-10 text-center sm:p-14">
            <div className="relative">
              <h2 className="font-display text-[clamp(1.5rem,3vw+0.5rem,2.2rem)] font-extrabold tracking-tight text-white">
                Готовы оценить свою технологию?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14.5px] text-white/85">
                Регистрация занимает минуту. Пройдите экспресс-оценку УГТ и получите
                предварительный уровень готовности с радаром зрелости — бесплатно.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-tz-accent px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  Зарегистрироваться <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/methodology"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-tz-surface/10"
                >
                  Изучить методику
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
