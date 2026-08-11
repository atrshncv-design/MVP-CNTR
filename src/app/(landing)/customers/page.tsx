import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Landmark, Factory, TrendingUp } from "lucide-react";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Заказчикам — Технозрелость",
  description:
    "Кому платформа «Технозрелость» помогает как заказчику: госкомпаниям, научным организациям, инвесторам, региональным ведомствам.",
};

const CUSTOMERS = [
  {
    icon: Building2,
    title: "Госкомпании и крупные заказчики",
    text: "Оцените зрелость разработок до закупки или контракта: официальный УГТ по ГОСТ Р 58048-2017, документы этапов и радар зрелости вместо «верю на слово». Управляйте портфелем технологических проектов, командой и бюджетом в одном кабинете.",
    points: ["Экспресс-оценка УГТ перед решением", "Генерация ТЗ, паспорта и ТЭО", "Прозрачная верификация Центра"],
  },
  {
    icon: Landmark,
    title: "Научные организации",
    text: "Покажите готовность ваших разработок к внедрению: публикации, патентные исследования и результаты исследований фиксируются как документы уровней УГТ 1–3. Инвесторы и производители видят научный задел в реестрах платформы.",
    points: ["Реестр научного задела", "Мини-ТЗ и паспорта разработок", "Выход на индустриальных партнёров"],
  },
  {
    icon: Factory,
    title: "Серийные производители",
    text: "Ищите технологии, готовые к внедрению: реестр технологий УГТ 7+ с фильтрами по области и бюджету. Подавайте заявку на лицензирование прямо из карточки технологии.",
    points: ["Реестр технологий УГТ 7+", "Заявка на лицензию из карточки", "Фильтры по технологии и бюджету"],
  },
  {
    icon: TrendingUp,
    title: "Инвесторы",
    text: "Принимайте решения на данных, а не на презентациях: общий реестр проектов с УГТ-уровнями, радар зрелости и документы этапов. Виден весь путь проекта — от черновика до серийного производства.",
    points: ["Реестр проектов с УГТ", "Радар зрелости read-only", "История верификаций Центра"],
  },
];

export default function CustomersPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">Заказчикам</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">
          Кому платформа помогает принимать решения о технологиях
        </h1>
        <p className="tz-lead mt-4 max-w-2xl">
          Платформа превращает оценку технологий из экспертного мнения в проверяемый
          процесс: официальный УГТ, документы этапов и решения менеджера ЦНТР видны
          всем сторонам проекта.
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
            Зарегистрироваться <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/levels" className="tz-btn tz-btn-secondary">
            Посмотреть уровни УГТ
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
