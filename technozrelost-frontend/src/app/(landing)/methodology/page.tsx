import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gauge, Radar, ShieldCheck, FileStack, Database } from "lucide-react";
import Reveal from "@/components/landing/reveal";
import { UGTScaleStrip, UGTBadge } from "@/components/landing/ugt-card";

export const metadata: Metadata = {
  title: "Методика оценки УГТ — Технозрелость",
  description:
    "Как оценивается уровень готовности технологий по ГОСТ Р 58048-2017: 9 уровней, 4 категории готовности, визард, радар, верификация менеджером ЦНТР.",
};

const CATEGORIES = [
  {
    title: "Научная готовность",
    text: "Насколько обоснованы физические принципы, опубликованы результаты и подтверждена научная состоятельность идеи.",
  },
  {
    title: "Техническая готовность",
    text: "Насколько проработана конструкция, проведены расчёты и моделирование, созданы и испытаны прототипы.",
  },
  {
    title: "Организационная готовность",
    text: "Готовность команды, плана работ, бюджета, прав на результаты интеллектуальной деятельности и партнёрств.",
  },
  {
    title: "Производственная готовность",
    text: "Готовность к серийному выпуску: технологичность, поставщики, производственные мощности и квалификация.",
  },
];

const FLOW = [
  {
    icon: Gauge,
    title: "Визард опросника",
    text: "Ответьте на вопросы 9 уровней по 4 категориям. Платформа считает предварительный УГТ — максимальный уровень, на котором требования выполнены непрерывно.",
  },
  {
    icon: Radar,
    title: "Радар зрелости",
    text: "Результат виден на радаре: где технология сильна, а где не хватает проработки — по каждой из четырёх категорий.",
  },
  {
    icon: ShieldCheck,
    title: "Верификация менеджером",
    text: "Менеджер ЦНТР проверяет черновик, присваивает официальный УГТ и публикует проект в общем реестре платформы.",
  },
  {
    icon: FileStack,
    title: "Рост уровня N→N+1",
    text: "Для каждого перехода есть словарь требований. Полный комплект документов этапа автоматически создаёт заявку на повышение — её верифицирует менеджер.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Reveal>
        <p className="tz-eyebrow">Методика</p>
        <h1 className="mt-3 max-w-2xl tz-page-title">
          Оценка УГТ по ГОСТ Р 58048-2017
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-tz-secondary">
          Уровень готовности технологии (УГТ) показывает, насколько разработка близка
          к промышленному применению — от базовых научных принципов (УГТ 1) до
          эксплуатации в реальном производстве (УГТ 9). Оценка строится на документах
          и проверяемых результатах, а не на самооценке.
        </p>
      </Reveal>

      {/* Шкала */}
      <Reveal delay={0.06}>
        <div className="mt-10 tz-card p-6">
          <p className="tz-eyebrow">Шкала 1–9</p>
          <div className="mt-4">
            <UGTScaleStrip />
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-tz-secondary">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-tz-ugt-low)" }} />
              1–3 · низкая готовность
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-tz-ugt-mid)" }} />
              4–6 · средняя готовность
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-tz-ugt-high)" }} />
              7–9 · высокая готовность
            </span>
          </div>
        </div>
      </Reveal>

      {/* Категории */}
      <section className="mt-16">
        <Reveal>
          <p className="tz-eyebrow">Четыре категории</p>
          <h2 className="mt-3 tz-page-title">Готовность оценивается не только технически</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.06}>
              <div className="tz-card h-full p-5">
                <h3 className="font-display text-[14.5px] font-bold text-tz-fg">{c.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-tz-secondary">{c.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Поток */}
      <section className="mt-16">
        <Reveal>
          <p className="tz-eyebrow">Как проходит оценка на платформе</p>
          <h2 className="mt-3 tz-page-title">Четыре шага процесса</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FLOW.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="tz-card h-full p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg tz-grad-bg text-white">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-[15px] font-bold text-tz-fg">{f.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-tz-secondary">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Документы */}
      <Reveal delay={0.08}>
        <div className="mt-16 tz-card flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl items-start gap-4">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-tz-accent-hover" />
            <div>
              <h3 className="font-display text-[15px] font-bold text-tz-fg">
                Документы этапов и верификация
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-tz-secondary">
                Для каждого перехода N→N+1 платформа собирает комплект документов.
                Предварительную оценку комплекта выполняет AI-ассистент по ГОСТам, а
                финальное решение принимает менеджер ЦНТР. Верифицирующие документы
                добавляет регулирующая организация — и они становятся материалом для
                решения.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <UGTBadge level={4} />
            <UGTBadge level={7} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/levels" className="tz-btn tz-btn-primary">
            Все уровни УГТ <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/register" className="tz-btn tz-btn-secondary">
            Пройти оценку
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
