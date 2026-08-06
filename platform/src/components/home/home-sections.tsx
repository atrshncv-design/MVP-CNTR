/**
 * D-04. Секции главной страницы — «живой первый экран и плотность».
 *
 * Все секции серверные (без «use client»): данные приходят из page.tsx
 * через getAdapter().getHomeSummary() (реальные 400 карточек НИОКТР) и
 * контролируемых UI-фикстур (только для честных счётчиков проверки).
 *
 * Счётчики — только из данных, тексты ролей — зеркало ROLES.md (roles.ts),
 * цвета — только токены тем (никаких новых значений).
 */

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileUp,
  FlaskConical,
  Inbox,
  Map,
  Rocket,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
import { BACKEND_ROLES } from "@/lib/roles.ts";
import { UGT_BAND_META, UGT_LEVELS } from "@/lib/ugt.ts";
import type { UgtBand } from "@/lib/ugt.ts";
import type { ResearchRecord } from "@/lib/types.ts";
import { RadarChart } from "@/components/radar";
import { UgtTrack } from "@/components/ugt/ugt-track";
import { SectionMark } from "@/components/udmurt/section-mark";
import { ResearchCard } from "@/components/registry/result-card.tsx";

/** Общий контейнер публичной части (совпадает с header/footer). */
export const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 md:px-8";

/* ------------------------------------------------------------------ */
/* Общие блоки                                                          */
/* ------------------------------------------------------------------ */

/** Заголовок секции: маркер (D-06) + h2 + вводный текст. */
function SectionHeader({
  markLabel,
  title,
  text,
}: {
  markLabel: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-2xl">
      <SectionMark label={markLabel} />
      <h2 className="mt-3 text-h2 font-semibold tracking-tight text-primary">
        {title}
      </h2>
      {text ? (
        <p className="mt-3 text-body leading-relaxed text-secondary">{text}</p>
      ) : null}
    </div>
  );
}

/** Действие главного входа: крупная кнопка с заголовком и подписью. */
function HeroAction({
  href,
  icon,
  title,
  subtitle,
  variant,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  variant: "primary" | "secondary";
}) {
  const base =
    "group inline-flex min-h-13 w-full flex-col items-center justify-center gap-1 rounded-control px-7 py-3 text-center transition-colors sm:w-64 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
  const styles =
    variant === "primary"
      ? "bg-accent-strong text-accent-contrast hover:opacity-90"
      : "border border-border-strong bg-surface text-primary hover:border-accent hover:text-accent";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      <span className="flex items-center gap-2.5 text-body font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-small text-current opacity-75">{subtitle}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Hero-комбо (Q4): заголовок + действия + радар + мини-трек +       */
/*    мини-счётчики живых данных                                        */
/* ------------------------------------------------------------------ */

export function HeroSection({
  researchCount,
  rolesCount,
  inReviewCount,
}: {
  researchCount: number;
  rolesCount: number;
  inReviewCount: number;
}) {
  const counters = [
    {
      value: researchCount,
      label: "исследований и НИОКТР",
      href: "/research",
    },
    {
      value: rolesCount,
      label: "ролей участников",
      href: "/partners",
    },
    {
      value: inReviewCount,
      label: "досье в проверке",
      href: "/technologies",
    },
  ];

  return (
    <section className={`${CONTAINER} pt-10 pb-12 md:pt-14 md:pb-16`}>
      <div className="grid items-start gap-10 lg:grid-cols-[7fr_5fr] lg:gap-14">
        {/* Левая колонка: обещание экосистемы + действия + счётчики */}
        <div>
          <SectionMark label="Центр научно-технологического развития Удмуртии" />
          <h1 className="mt-4 text-display font-semibold leading-[1.1] tracking-tight text-primary">
            Технологии Удмуртии — от идеи к серийному производству
          </h1>
          <p className="mt-5 max-w-2xl text-body-lg leading-relaxed text-primary">
            Единая цифровая среда, где наука, промышленность и институты
            развития ведут технологию от идеи к серийному производству.
          </p>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-secondary">
            Платформа показывает текущую готовность технологии, доказательства
            за ней, следующий проверенный шаг, доступных партнёров и путь к
            внедрению.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch">
            <HeroAction
              href="/find"
              icon={<Search className="h-5 w-5" aria-hidden />}
              title="Найти решение"
              subtitle="Технологии, исполнители, запросы и поддержка"
              variant="primary"
            />
            <HeroAction
              href="/register"
              icon={<FileUp className="h-5 w-5" aria-hidden />}
              title="Представить технологию"
              subtitle="Создать досье и начать путь готовности"
              variant="secondary"
            />
          </div>

          {/* Мини-счётчики: реальные числа из данных */}
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-border-subtle pt-6">
            {counters.map((counter) => (
              <li key={counter.label}>
                <Link
                  href={counter.href}
                  className="group block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <span className="block font-display text-h2 font-semibold leading-none text-primary transition-colors group-hover:text-accent">
                    {counter.value}
                  </span>
                  <span className="mt-1.5 block text-small text-muted">
                    {counter.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Правая колонка: радар 4 измерений + компактный мини-трек УГТ */}
        <div className="flex flex-col gap-4">
          <div className="rounded-panel border border-border-subtle bg-surface p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-small font-semibold text-primary">
                Готовность по четырём измерениям
              </p>
              <Link
                href="/methodology/ugt"
                className="inline-flex items-center gap-1 text-meta font-medium text-link underline-offset-4 hover:underline"
              >
                Методика
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <div className="mt-3 flex justify-center">
              <RadarChart scores={[]} size={230} />
            </div>
            <p className="mt-3 text-center text-meta text-muted">
              Оценка появится после первой верификации досье Центром — сейчас
              по измерениям готовности данных нет
            </p>
          </div>

          <div className="rounded-panel border border-border-subtle bg-surface p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-small font-semibold text-primary">
                Шкала УГТ 1–9
              </p>
              <Link
                href="/methodology/ugt"
                className="inline-flex items-center gap-1 text-meta font-medium text-link underline-offset-4 hover:underline"
              >
                Что означает уровень
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <div className="mt-3">
              <UgtTrack currentLevel={1} verified={false} compact />
            </div>
            <p className="mt-3 text-meta text-muted">
              Пример: заявленный УГТ 1 — подтверждённым уровень становится
              только после проверки Центра
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. «Сейчас на платформе»: живые ссылки на реестры с реальными        */
/*    счётчиками (без «Раздел готов к наполнению»)                      */
/* ------------------------------------------------------------------ */

export function RegistrySection({
  researchCount,
  inReviewCount,
}: {
  researchCount: number;
  inReviewCount: number;
}) {
  const registries = [
    {
      href: "/research",
      icon: <FlaskConical className="h-5 w-5" aria-hidden />,
      value: researchCount,
      valueLabel: "карточек",
      title: "Исследования и НИОКТР",
      note: "Открытый реестр из данных Минобрнауки России: поиск, фильтры и карточки работ.",
    },
    {
      href: "/technologies",
      icon: <Rocket className="h-5 w-5" aria-hidden />,
      value: 0,
      valueLabel: "опубликовано",
      title: "Технологии",
      note: `${inReviewCount} досье на проверке. Публикация — только после верификации досье Центром.`,
    },
    {
      href: "/requests",
      icon: <Inbox className="h-5 w-5" aria-hidden />,
      value: 0,
      valueLabel: "опубликовано",
      title: "Запросы заказчиков",
      note: "Первые запросы появятся после запуска приёмной кампании и проверки Центром.",
    },
  ];

  return (
    <section className={`${CONTAINER} py-12 md:py-16`}>
      <SectionHeader
        markLabel="Живые реестры"
        title="Сейчас на платформе"
        text="Публичные реестры наполняются только проверенными записями: без проверки Центром нет публикации."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {registries.map((registry) => (
          <Link
            key={registry.href}
            href={registry.href}
            className="group flex flex-col rounded-panel border border-border-subtle bg-surface p-6 transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                {registry.icon}
              </span>
              <ArrowUpRight
                className="h-4 w-4 text-muted transition-colors group-hover:text-accent"
                aria-hidden
              />
            </span>
            <span className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-h2 font-semibold leading-none text-primary">
                {registry.value}
              </span>
              <span className="text-meta text-muted">{registry.valueLabel}</span>
            </span>
            <span className="mt-1.5 text-small font-semibold text-primary">
              {registry.title}
            </span>
            <span className="mt-1.5 text-small leading-relaxed text-secondary">
              {registry.note}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. «Как это работает»: нумерованные шаги 01/02/03                    */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    number: "01",
    title: "Экспресс-оценка",
    text: "Опишите технологию: назначение, текущий уровень УГТ и свидетельства. Платформа покажет предварительную готовность по четырём измерениям.",
    href: "/register",
    linkLabel: "Начать досье",
  },
  {
    number: "02",
    title: "Верификация Центра",
    text: "Специалисты Центра проверяют заявленный уровень и доказательства по методике ГОСТ Р 58048-2017. Без проверки запись не публикуется.",
    href: "/methodology/ugt",
    linkLabel: "Уровни УГТ 1–9",
  },
  {
    number: "03",
    title: "Рост N → N+1",
    text: "Подтверждённый уровень открывает следующий шаг: соберите свидетельства, пройдите проверку и переведите технологию на новый уровень готовности.",
    href: "/register",
    linkLabel: "Представить технологию",
  },
];

export function StepsSection() {
  return (
    <section className={`${CONTAINER} py-12 md:py-16`}>
      <SectionHeader
        markLabel="Путь технологии"
        title="Как это работает"
        text="Три шага от заявки до подтверждённого уровня готовности — с проверкой на каждом переходе."
      />
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="flex flex-col rounded-panel border border-border-subtle bg-surface p-6"
          >
            <span
              aria-hidden
              className="font-display text-h1 font-semibold leading-none text-accent"
            >
              {step.number}
            </span>
            <h3 className="mt-4 text-h3 font-semibold tracking-tight text-primary">
              {step.title}
            </h3>
            <p className="mt-2 text-small leading-relaxed text-secondary">
              {step.text}
            </p>
            <Link
              href={step.href}
              className="mt-4 inline-flex items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
            >
              {step.linkLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. «Экосистема участников»: 9 ролей из roles.ts (зеркало ROLES.md)   */
/* ------------------------------------------------------------------ */

export function RolesSection() {
  return (
    <section className={`${CONTAINER} py-12 md:py-16`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeader
          markLabel="Участники"
          title="Экосистема участников"
          text="Заказчики, разработчики, наука, производство, эксперты и Центр — у каждой роли своя задача на платформе."
        />
        <Link
          href="/partners"
          className="inline-flex shrink-0 items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
        >
          Каталог организаций и исполнителей
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BACKEND_ROLES.map((role) => (
          <li
            key={role.id}
            className="rounded-control border border-border-subtle bg-surface p-4"
          >
            <h3 className="text-small font-semibold text-primary">
              {role.label}
            </h3>
            <p className="mt-1 text-small leading-relaxed text-secondary">
              {role.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. «Что означает уровень»: компактные ссылки УГТ 1–9 (цвета — из     */
/*    существующих токенов шкалы, не новые)                             */
/* ------------------------------------------------------------------ */

const BAND_TEXT: Record<UgtBand, string> = {
  low: "text-ugt-low",
  medium: "text-ugt-medium",
  high: "text-ugt-high",
};

export function LevelsSection() {
  return (
    <section className={`${CONTAINER} py-12 md:py-16`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeader
          markLabel="Шкала готовности"
          title="Что означает уровень"
          text="УГТ 1–9 по ГОСТ Р 58048-2017: низкие уровни — идея и лаборатория, средние — прототип и пилот, высокие — серия и производство."
        />
        <Link
          href="/methodology/ugt"
          className="inline-flex shrink-0 items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
        >
          Методика оценки
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-9">
        {UGT_LEVELS.map((level) => (
          <li key={level.number}>
            <Link
              href="/methodology/ugt"
              className="group flex flex-col gap-1.5 rounded-control border border-border-subtle bg-surface px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`ugt-marker ${BAND_TEXT[level.band]}`}
                />
                <span
                  className={`font-mono text-small font-semibold ${BAND_TEXT[level.band]}`}
                >
                  УГТ {level.number}
                </span>
              </span>
              <span className="truncate text-meta text-muted">{level.short}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Легенда диапазонов — из UGT_BAND_META (не новые формулировки) */}
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {[UGT_BAND_META.low, UGT_BAND_META.medium, UGT_BAND_META.high].map(
          (band) => (
            <li key={band.band} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`ugt-marker ${BAND_TEXT[band.band]}`}
              />
              <span className="text-small text-secondary">
                {band.label}{" "}
                <span className="font-mono text-meta text-muted">
                  УГТ {band.range[0]}–{band.range[1]}
                </span>
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. «Последние верифицированные записи»: реальные карточки НИОКТР     */
/*    (последние по дате) с provenance-бейджем                          */
/* ------------------------------------------------------------------ */

export function RecentSection({ records }: { records: ResearchRecord[] }) {
  const recent = records.slice(0, 4);

  return (
    <section className={`${CONTAINER} py-12 md:py-16`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeader
          markLabel="Проверено и опубликовано"
          title="Последние верифицированные записи"
          text="Реальные карточки НИОКТР из открытого реестра — последние по дате, с указанием источника данных."
        />
        <Link
          href="/research"
          className="inline-flex shrink-0 items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
        >
          Открыть реестр исследований
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {recent.map((record) => (
          <ResearchCard
            key={record.registrationNumber}
            record={record}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Карта экосистемы — сжатый честный блок ниже (не первый экран)     */
/* ------------------------------------------------------------------ */

export function MapSection() {
  return (
    <section className={`${CONTAINER} py-12 md:py-16`}>
      <div className="flex flex-col gap-5 rounded-surface border border-border-subtle bg-surface p-6 md:flex-row md:items-center md:gap-6 md:p-8">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"
        >
          <Map className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-h3 font-semibold tracking-tight text-primary">
            Карта экосистемы Удмуртии
          </h2>
          <p className="mt-1.5 text-small leading-relaxed text-secondary">
            Появится после подключения данных о регионе: технологии,
            организации, производственные площадки и институты развития — по
            отраслям и территориям.
          </p>
        </div>
        <span className="shrink-0 rounded-[6px] bg-surface-elevated px-2.5 py-1 font-mono text-meta text-muted">
          после подключения данных
        </span>
      </div>
    </section>
  );
}
