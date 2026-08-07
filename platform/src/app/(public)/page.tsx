import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  FileUp,
  FlaskConical,
  Inbox,
  Map,
  Route,
  Search,
  TrendingUp,
} from "lucide-react";

/**
 * T-002. Главная страница публичной части.
 * Композиция — Design.md §12.1 (НЕ герой → 3 карточки → CTA):
 *   1. identity/навигация — в layout;
 *   2. hero с обещанием экосистемы;
 *   3. два РАВНЫХ действия: «Найти решение» / «Представить технологию»;
 *   4. превью реальных данных — честное пустое состояние (адаптер T-004 ещё не готов);
 *   5. объяснение пути технологии (УГТ 1–9, горизонтальный путь на desktop);
 *   6. вход в карту экосистемы;
 *   7. доказательства Центра: методология, верификация, прогресс;
 *   8. последние верифицированные записи — честное пустое состояние;
 *   9. приглашение зарегистрироваться / связаться с Центром.
 * Анти-slop (§6.2): редакционная композиция, списки с разделителями,
 * акцент только в действиях, радиусы 8/12/16px, без пилюль.
 */

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 md:px-8";

function SectionDivider() {
  return <hr className="section-divider" aria-hidden />;
}

function SectionShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`py-16 md:py-24 ${className}`}>{children}</section>;
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
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  variant: "primary" | "secondary";
}) {
  const base =
    "group inline-flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-control px-7 py-3 text-center transition-colors sm:w-72 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
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

/** Шкала УГТ 1–9: горизонтальный путь на desktop, вертикальный список на mobile (§11.5). */
function UgtPath() {
  const levels = Array.from({ length: 9 }, (_, i) => i + 1);
  const bandClass = (level: number) =>
    level <= 3 ? "text-ugt-low" : level <= 6 ? "text-ugt-medium" : "text-ugt-high";
  const bandName = (level: number) =>
    level <= 3 ? "Низкая готовность" : level <= 6 ? "Средняя готовность" : "Высокая готовность";

  return (
    <div>
      {/* Desktop: горизонтальный путь */}
      <div className="hidden lg:block">
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-x-0 top-[13px] h-px bg-border-strong"
          />
          <ol className="relative flex items-start justify-between">
            {levels.map((level) => (
              <li key={level} className="flex w-9 flex-col items-center gap-2">
                <span
                  className={`ugt-marker ${bandClass(level)}`}
                  aria-hidden
                />
                <span className="font-mono text-meta text-muted">{level}</span>
              </li>
            ))}
          </ol>
        </div>
        <dl className="mt-10 divide-y divide-border-subtle border-y border-border-subtle">
          {[
            { range: "1–3", name: "Низкая готовность", text: "Идея и лабораторные результаты, формирование доказательной базы", color: "text-ugt-low" },
            { range: "4–6", name: "Средняя готовность", text: "Прототип и опытный образец, испытания, первые применения", color: "text-ugt-medium" },
            { range: "7–9", name: "Высокая готовность", text: "Производство, серия, внедрение и подтверждённые результаты", color: "text-ugt-high" },
          ].map((band) => (
            <div key={band.range} className="flex items-baseline gap-4 py-4">
              <dt className={`ugt-marker shrink-0 ${band.color}`} aria-hidden />
              <dd className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-small font-semibold text-primary">
                  УГТ {band.range}
                </span>
                <span className="text-small text-secondary">{band.name}</span>
                <span className="w-full text-meta text-muted sm:w-auto">
                  {band.text}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Mobile: вертикальный путь */}
      <ol className="divide-y divide-border-subtle border-y border-border-subtle lg:hidden">
        {levels.map((level) => (
          <li key={level} className="flex min-h-12 items-center gap-3 py-2">
            <span className={`ugt-marker ${bandClass(level)}`} aria-hidden />
            <span className="font-mono text-meta text-muted">УГТ {level}</span>
            <span className="ml-auto text-meta text-muted">
              {bandName(level)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Честное пустое состояние раздела (адаптер T-004 ещё не готов). */
function EmptyData({
  title,
  text,
  links,
}: {
  title: string;
  text: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-panel border border-border-subtle bg-surface p-6 md:p-8">
      <span
        aria-hidden
        className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-surface-elevated text-muted"
      >
        <Inbox className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-body font-semibold text-primary">{title}</h3>
        <p className="mt-1.5 text-small leading-relaxed text-secondary">
          {text}
        </p>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
            >
              {link.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* ===== 2–3. Hero: обещание экосистемы + два равных действия ===== */}
      <section className={`${CONTAINER} py-16 md:py-24`}>
        <div className="max-w-3xl">
          <h1 className="text-display font-semibold leading-[1.1] tracking-tight text-primary">
            Технологии Удмуртии — от идеи к серийному производству
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg leading-relaxed text-primary">
            Единая цифровая среда, где наука, промышленность и институты
            развития ведут технологию от идеи к серийному производству.
          </p>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-secondary">
            Платформа показывает текущую готовность технологии, доказательства
            за ней, следующий проверенный шаг, доступных партнёров и путь к
            внедрению.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
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

        <p className="mt-8">
          <Link
            href="/methodology"
            className="inline-flex items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
          >
            Как определяется готовность технологии
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </p>
      </section>

      <div className={`${CONTAINER}`}>
        <SectionDivider />
      </div>

      {/* ===== 4. Превью реальных данных (честное пустое состояние) ===== */}
      <SectionShell className={`${CONTAINER}`}>
        <div className="grid items-start gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div>
            <h2 className="text-h2 font-semibold tracking-tight text-primary">
              Сейчас на платформе
            </h2>
            <p className="mt-4 text-body leading-relaxed text-secondary">
              Публичные реестры: технологии, запросы заказчиков, организации и
              исполнители, исследования и НИОКТР. Записи появляются после
              проверки специалистами Центра — без проверки нет публикации.
            </p>
            <p className="mt-4">
              <Link
                href="/find"
                className="inline-flex items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
              >
                Открыть поиск по платформе
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </p>
          </div>
          <EmptyData
            title="Раздел готов к наполнению"
            text="Публикация реестра технологий и запросов начнётся после подключения данных. Уже доступен реестр исследований и НИОКТР."
            links={[
              { label: "Реестр технологий", href: "/technologies" },
              { label: "Исследования и НИОКТР", href: "/research" },
            ]}
          />
        </div>
      </SectionShell>

      <div className={`${CONTAINER}`}>
        <SectionDivider />
      </div>

      {/* ===== 5. Путь технологии: УГТ 1–9 ===== */}
      <SectionShell className={`${CONTAINER}`}>
        <div className="grid items-start gap-10 lg:grid-cols-[5fr_7fr] lg:gap-14">
          <div>
            <h2 className="text-h2 font-semibold tracking-tight text-primary">
              Путь технологии: от идеи к серийному производству
            </h2>
            <p className="mt-4 text-body leading-relaxed text-secondary">
              Уровень готовности технологии (УГТ) — расстояние до конкретного
              результата внедрения, а не общая оценка качества. Готовность
              оценивается по четырём измерениям: научная, техническая,
              организационная и производственная.
            </p>
            <p className="mt-4">
              <Link
                href="/methodology"
                className="inline-flex items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
              >
                <Route className="h-4 w-4" aria-hidden />
                Как работает оценка
              </Link>
            </p>
            <p className="mt-2.5">
              <Link
                href="/levels"
                className="inline-flex items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline"
              >
                <FlaskConical className="h-4 w-4" aria-hidden />
                Все уровни УГТ 1–9
              </Link>
            </p>
          </div>
          <UgtPath />
        </div>
      </SectionShell>

      <div className={`${CONTAINER}`}>
        <SectionDivider />
      </div>

      {/* ===== 6. Вход в карту экосистемы ===== */}
      <SectionShell className={`${CONTAINER}`}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="order-2 lg:order-1">
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-surface border border-border-subtle bg-surface p-8 text-center">
              <span
                aria-hidden
                className="inline-flex h-12 w-12 items-center justify-center rounded-control bg-accent-soft text-accent"
              >
                <Map className="h-6 w-6" />
              </span>
              <p className="text-body font-semibold text-primary">
                Карта экосистемы Удмуртии
              </p>
              <p className="max-w-sm text-small leading-relaxed text-secondary">
                Раздел готов к наполнению: карта свяжет технологии,
                организации, производственные площадки и институты развития
                по отраслям и территориям региона.
              </p>
              <Link
                href="/map"
                className="inline-flex h-10 items-center gap-1.5 rounded-control border border-border-strong px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent"
              >
                Открыть карту
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-h2 font-semibold tracking-tight text-primary">
              Экосистема региона на одной карте
            </h2>
            <p className="mt-4 text-body leading-relaxed text-secondary">
              Технологии, организации, производственные возможности, меры
              поддержки и институты развития — с привязкой к отраслям и
              территориям. Карта помогает найти соседей по цепочке создания
              стоимости и понять, кто рядом.
            </p>
            <p className="mt-4 text-small leading-relaxed text-muted">
              Карта появится после подключения данных о регионе.
            </p>
          </div>
        </div>
      </SectionShell>

      <div className={`${CONTAINER}`}>
        <SectionDivider />
      </div>

      {/* ===== 7. Доказательства Центра: методология, верификация, прогресс ===== */}
      <SectionShell className={`${CONTAINER}`}>
        <div className="max-w-2xl">
          <h2 className="text-h2 font-semibold tracking-tight text-primary">
            Почему результатам можно доверять
          </h2>
          <p className="mt-4 text-body leading-relaxed text-secondary">
            Платформа опирается на методику, проверку доказательств и понятный
            прогресс — а не на рекламные формулировки.
          </p>
        </div>
        <div className="mt-10 max-w-3xl divide-y divide-border-subtle border-y border-border-subtle">
          {[
            {
              icon: <BookOpen className="h-5 w-5" aria-hidden />,
              title: "Методика готовности",
              text: "Оценка по ГОСТ Р 58048-2017: четыре измерения — научная, техническая, организационная и производственная готовность. УГТ показывает расстояние до конкретного результата внедрения.",
              href: "/methodology",
              linkLabel: "Методология",
            },
            {
              icon: <BadgeCheck className="h-5 w-5" aria-hidden />,
              title: "Верификация доказательств",
              text: "Каждый уровень подтверждается документами и проверяется специалистами Центра. Без прохождения проверки запись не публикуется в открытых реестрах.",
              href: "/methodology",
              linkLabel: "Как проверяются записи",
            },
            {
              icon: <TrendingUp className="h-5 w-5" aria-hidden />,
              title: "Проверенный следующий шаг",
              text: "Вместо общего балла — текущий уровень готовности, доказательства за ним и конкретное следующее действие на пути к серийному производству.",
              href: "/levels",
              linkLabel: "Уровни УГТ 1–9",
            },
          ].map((row) => (
            <div
              key={row.title}
              className="flex items-start gap-4 py-6 md:items-center"
            >
              <span
                aria-hidden
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"
              >
                {row.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-body font-semibold text-primary">
                  {row.title}
                </h3>
                <p className="mt-1.5 text-small leading-relaxed text-secondary">
                  {row.text}
                </p>
              </div>
              <Link
                href={row.href}
                className="ml-auto hidden shrink-0 items-center gap-1.5 text-small font-medium text-link underline-offset-4 hover:underline sm:inline-flex"
              >
                {row.linkLabel}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </SectionShell>

      <div className={`${CONTAINER}`}>
        <SectionDivider />
      </div>

      {/* ===== 8. Последние верифицированные записи (честное пустое состояние) ===== */}
      <SectionShell className={`${CONTAINER}`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-h2 font-semibold tracking-tight text-primary">
              Последние верифицированные записи
            </h2>
            <p className="mt-3 text-body leading-relaxed text-secondary">
              Пока нет опубликованных записей. Когда появятся проверенные
              технологии, запросы и исследования, они будут здесь — с текущим
              уровнем готовности и доказательствами.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/find"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-accent-strong px-5 text-sm font-medium text-accent-contrast transition-colors hover:opacity-90"
            >
              <Search className="h-4 w-4" aria-hidden />
              Найти решение
            </Link>
            <Link
              href="/research"
              className="inline-flex h-11 items-center justify-center rounded-control border border-border-strong px-5 text-sm font-medium text-primary transition-colors hover:bg-surface-elevated"
            >
              Исследования и НИОКТР
            </Link>
          </div>
        </div>
      </SectionShell>

      {/* ===== 9. Приглашение зарегистрироваться / связаться с Центром ===== */}
      <section className={`${CONTAINER} pb-20 md:pb-28`}>
        <div className="flex flex-col gap-8 rounded-surface bg-accent-soft p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="max-w-xl">
            <h2 className="text-h2 font-semibold tracking-tight text-primary">
              Представьте технологию или найдите решение
            </h2>
            <p className="mt-3 text-body leading-relaxed text-secondary">
              Зарегистрируйтесь, чтобы создать досье технологии, отвечать на
              запросы заказчиков, находить партнёров и участвовать в пилотах.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent-strong px-6 text-sm font-semibold text-accent-contrast transition-colors hover:opacity-90"
            >
              <FileUp className="h-4 w-4" aria-hidden />
              Подать технологию
            </Link>
            <Link
              href="/about"
              className="inline-flex h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-6 text-sm font-semibold text-primary transition-colors hover:border-accent hover:text-accent"
            >
              Связаться с Центром
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
