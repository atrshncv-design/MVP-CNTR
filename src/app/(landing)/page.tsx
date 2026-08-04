import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  ClipboardCheck,
  Layers,
  Route,
  ShieldCheck,
  Building2,
  FlaskConical,
  Factory,
  Landmark,
  GraduationCap,
  Users,
  Settings,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import Reveal from "@/components/landing/reveal";
import LivingRadar from "@/components/landing/living-radar";
import { UGTScaleStrip } from "@/components/landing/ugt-card";
import { UGT_LEVELS } from "@/lib/ugt-data";
import { ROLES } from "@/lib/roles";

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

const ROLE_META: Record<string, { icon: typeof Users; desc: string }> = {
  gk_customer: {
    icon: Building2,
    desc: "Оценивает УГТ, создаёт проекты, управляет командой и бюджетом, генерирует ТЗ, паспорт и ТЭО.",
  },
  rd_executor: {
    icon: FlaskConical,
    desc: "Ведёт работы по проектам, загружает отчёты и документы этапов, инициирует автозаявку на повышение УГТ.",
  },
  scientific_org: {
    icon: GraduationCap,
    desc: "Формирует научный задел: публикации, патентные исследования, мини-технические задания.",
  },
  serial_manufacturer: {
    icon: Factory,
    desc: "Находит технологии УГТ 7+ в реестре и подаёт заявки на лицензирование.",
  },
  regulating_organization: {
    icon: Landmark,
    desc: "Присоединяется к проекту по токену и добавляет верифицирующие документы — подтверждение УГТ для менеджера.",
  },
  auditor: {
    icon: BarChart3,
    desc: "Принимает решения Go/No-Go по контрольным точкам проекта.",
  },
  investor: {
    icon: TrendingUp,
    desc: "Изучает реестры проектов и технологий, видит радар зрелости разработок.",
  },
  cntr_admin: {
    icon: Settings,
    desc: "Управляет пользователями и ролями, загружает ГОСТы и шаблоны в базу знаний платформы.",
  },
  cntr_manager: {
    icon: Users,
    desc: "Ведёт очереди проектов и заявок: присваивает официальный УГТ и верифицирует переходы N→N+1.",
  },
};

export default function LandingHome() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px]">
          <div className="max-w-2xl">
            <Reveal>
              <p className="tz-eyebrow">ЦНТР Удмуртии · Цифровая платформа трансфера технологий</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-4 font-display text-[clamp(2rem,5vw+0.5rem,3.2rem)] font-extrabold leading-[1.08] tracking-tight text-tz-fg">
                Путь технологии от идеи до серийного производства —{" "}
                <span className="tz-grad-text">на одной платформе</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-[15.5px] leading-relaxed text-tz-secondary">
                «Технозрелость» — цифровая инфраструктура Центра технологического развития
                Удмуртской Республики. Оценивайте уровень готовности технологий (УГТ) по
                ГОСТ Р 58048-2017, ведите проект уровнями N→N+1 и доводите разработку до
                внедрения — с верификацией Центра и живыми реестрами.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-7 flex flex-wrap items-center gap-3">
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

          {/* Живой радар (D10) */}
          <Reveal delay={0.15} className="hidden lg:block">
            <div className="tz-glass relative flex aspect-square items-center justify-center rounded-3xl p-8 text-tz-accent">
              <LivingRadar className="w-full max-w-[340px]" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Тёплая шкала УГТ ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
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
          <div className="mt-6">
            <UGTScaleStrip />
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

      {/* ── 9 ролей ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="tz-eyebrow">Экосистема участников</p>
          <h2 className="mt-3 max-w-2xl tz-page-title">
            Девять ролей — каждый участник работает в своём кабинете
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r, i) => {
            const meta = ROLE_META[r.slug] ?? { icon: Users, desc: "" };
            return (
              <Reveal key={r.slug} delay={(i % 3) * 0.06}>
                <div className="tz-card tz-card-hover h-full p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-tz-border bg-tz-soft text-tz-accent-hover">
                      <meta.icon className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="font-display text-[14.5px] font-bold leading-snug text-tz-fg">
                      {r.name}
                    </h3>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-tz-secondary">
                    {meta.desc}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── УГТ-уровни (сетка) ───────────────────────────────────── */}
      <section className="border-y border-tz-border/60 bg-tz-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="tz-eyebrow">Методика</p>
                <h2 className="mt-3 tz-page-title">Что означает каждый уровень</h2>
              </div>
              <Link href="/methodology" className="tz-btn tz-btn-ghost tz-btn-sm">
                Методика оценки <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UGT_LEVELS.map((lvl, i) => (
              <Reveal key={lvl.id} delay={(i % 3) * 0.06}>
                <Link
                  href={`/levels/${lvl.id}`}
                  className="tz-card tz-card-hover block h-full p-5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono text-sm font-bold"
                      style={{
                        color:
                          lvl.id <= 3
                            ? "var(--color-tz-ugt-low)"
                            : lvl.id <= 6
                              ? "var(--color-tz-ugt-mid)"
                              : "var(--color-tz-ugt-high)",
                      }}
                    >
                      УГТ {lvl.id}
                    </span>
                    <Layers className="h-4 w-4 text-tz-muted" />
                  </div>
                  <h3 className="mt-3 font-display text-[15px] font-bold text-tz-fg">
                    {lvl.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-tz-secondary">
                    {lvl.short}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
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
                  className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
