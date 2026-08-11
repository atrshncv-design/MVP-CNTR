import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical, Factory, Landmark, Rocket } from "lucide-react";
import Reveal from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Исполнителям — Технозрелость",
  description:
    "Кому платформа «Технозрелость» помогает как исполнителю: R&D-организациям, серийным производителям, регулирующим организациям, инженерным командам.",
};

const PERFORMERS = [
  {
    icon: FlaskConical,
    title: "R&D-исполнители и разработчики",
    text: "Ведите технологический проект по уровням УГТ: фиксируйте результаты каждого этапа, загружайте документы и получайте автозаявку на повышение уровня автоматически — по полноте комплекта. Платформа сама напомнит, чего не хватает для перехода N→N+1.",
    points: ["Документы этапов вместо отчётов «в стол»", "Автозаявка на повышение УГТ", "Публикация в реестре после апрува"],
  },
  {
    icon: Factory,
    title: "Серийные производители",
    text: "Берите зрелые технологии (УГТ 7+) в лицензирование и производство: реестр технологий с фильтрами, карточка с документами и заявка на лицензию одним кликом.",
    points: ["Доступ к реестру УГТ 7+", "Заявка на лицензию из карточки", "Прямой контакт с владельцем технологии"],
  },
  {
    icon: Landmark,
    title: "Регулирующие организации",
    text: "Присоединяйтесь к проекту по токену TZ-XXXXXX и добавляйте верифицирующие документы — подтверждение УГТ. Эти документы попадают в очередь менеджера ЦНТР и становятся материалом для официального решения.",
    points: ["Вступление по токену", "Верифицирующие документы", "Материал для решения менеджера"],
  },
  {
    icon: Rocket,
    title: "Инженерные команды и стартапы",
    text: "Покажите инвесторам и заказчикам объективный уровень готовности вашей разработки. Экспресс-оценка бесплатна и занимает минуты — вы сразу увидите, каких уровней не хватает до внедрения.",
    points: ["Бесплатная экспресс-оценка", "Радар зрелости по 4 категориям", "Понятный путь до УГТ 7+"],
  },
];

export default function PerformersPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">Исполнителям</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">
          Как платформа помогает доводить технологии до внедрения
        </h1>
        <p className="tz-lead mt-4 max-w-2xl">
          Для исполнителей платформа — это рабочий инструмент проекта: документы,
          этапы, верификация и выход на заказчиков и инвесторов через реестры.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {PERFORMERS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.06}>
            <div className="tz-card tz-card-hover h-full p-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg tz-grad-bg text-white">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="tz-card-title mt-4">{p.title}</h2>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-tz-secondary">{p.text}</p>
              <ul className="mt-4 space-y-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2 text-[12.5px] text-tz-secondary">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-tz-accent-hover" />
                    {pt}
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
            Начать проект <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/methodology" className="tz-btn tz-btn-secondary">
            Изучить методику
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
