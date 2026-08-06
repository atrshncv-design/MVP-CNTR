"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Factory,
  FileText,
  FlaskConical,
  Info,
  XCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import nioktrDemo from "@/data/nioktr-demo.json";
import { UGT_LEVEL_COLORS } from "@/lib/ugt";

/**
 * T-001. Dev-демо-страница визуальной проверки дизайн-системы в трёх темах.
 * Содержимое — демонстрационные данные (T-004 подключит реальный адаптер).
 * Никаких хардкод-цветов: только утилиты от семантических токенов.
 */

const badgeStyles = {
  success: "bg-status-success-soft text-status-success",
  warning: "bg-status-warning-soft text-status-warning",
  danger: "bg-status-danger-soft text-status-danger",
  info: "bg-status-info-soft text-status-info",
  draft: "bg-status-draft-soft text-status-draft",
} as const;

const badgeIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  draft: FileText,
} as const;

function StatusBadge({
  kind,
  label,
}: {
  kind: keyof typeof badgeStyles;
  label: string;
}) {
  const Icon = badgeIcons[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-small font-medium ${badgeStyles[kind]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <hr className="section-divider" aria-hidden />
      <h2 className="mt-6 text-h2 font-semibold tracking-tight text-primary">
        {title}
      </h2>
      {intro ? (
        <p className="mt-2 max-w-2xl text-body leading-relaxed text-secondary">
          {intro}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** УГТ-бэнд: 1–3 низкий, 4–6 средний, 7–9 высокий (число + форма + подпись — не только цвет). */
const UGT_LEVELS = [
  { level: 1, band: "low", name: "Идея" },
  { level: 2, band: "low", name: "Концепция" },
  { level: 3, band: "low", name: "Лаборатория" },
  { level: 4, band: "medium", name: "Макет" },
  { level: 5, band: "medium", name: "Прототип" },
  { level: 6, band: "medium", name: "Пилот" },
  { level: 7, band: "high", name: "Опытный образец" },
  { level: 8, band: "high", name: "Серия 0" },
  { level: 9, band: "high", name: "Производство" },
] as const;

type NioktrCard = {
  registration_number: string;
  name: string;
  executor: string;
  customer: string;
  created_date: string;
  year: string;
  nioktr_types: string[];
  keywords: string[];
  is_ai_area: boolean;
  is_ai_usage: boolean;
  source: string;
};

// Реальные записи из реестра НИОКТР (источник: МИНОБРНАУКИ России).
// Срез из 5 карточек для демо; полный набор и адаптер — тикет T-004.
const demoRows = nioktrDemo.cards as NioktrCard[];

export default function TokensDemoPage() {
  return (
    <div className="flex flex-1 justify-center bg-canvas">
      <div className="w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
        {/* Шапка */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-meta text-muted">
              /dev/tokens · T-001 · дизайн-система и три темы
            </p>
            <h1 className="mt-3 text-h1 font-semibold tracking-tight text-primary">
              Семантические токены и темы
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg leading-relaxed text-secondary">
              Один компонент — три визуальных мира: светлая, тёмная и
              удмуртская тема. Структура, статусы и контраст не меняются при
              переключении. Текущая тема сохраняется в браузере.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Поверхности и геометрия */}
        <Section
          id="surfaces"
          title="Поверхности и геометрия"
          intro="Тональные ступени вместо рамок: canvas, поверхность и приподнятая поверхность. Радиусы 8 / 12 / 16 px по токенам — без пилюль."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-panel border border-border-subtle bg-canvas p-6">
              <p className="text-small font-medium text-primary">Canvas</p>
              <p className="mt-1 text-meta text-muted">
                Фон страницы, тональная база
              </p>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface p-6">
              <p className="text-small font-medium text-primary">Surface</p>
              <p className="mt-1 text-meta text-muted">
                Карточки и панели
              </p>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface-elevated p-6 shadow-sm">
              <p className="text-small font-medium text-primary">
                Surface elevated
              </p>
              <p className="mt-1 text-meta text-muted">
                Попапы, меню, выделение
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-[8px] border border-border-strong bg-surface px-4 py-2 text-small text-primary">
              Радиус 8 · контроль
            </span>
            <span className="rounded-[12px] border border-border-strong bg-surface px-4 py-2 text-small text-primary">
              Радиус 12 · панель
            </span>
            <span className="rounded-[16px] border border-border-strong bg-surface px-6 py-3 text-small text-primary">
              Радиус 16 · крупная поверхность
            </span>
            <span className="text-meta text-muted">
              Границы: subtle — разделение, strong — структура
            </span>
          </div>
        </Section>

        {/* Типографика */}
        <Section
          id="typography"
          title="Типографика"
          intro="Unbounded — акцидентный display-гротеск для заголовков, Golos Text — рабочая гарнитура текста, IBM Plex Mono — только идентификаторы и метаданные. Предложение по умолчанию, переносы естественные."
        >
          <div className="space-y-5">
            <div>
              <p className="text-display font-semibold tracking-tight text-primary">
                Технологии Удмуртии — от идеи до производства
              </p>
              <p className="text-meta text-muted">Display 64/68 → 40/44 · только публичный hero</p>
            </div>
            <div>
              <p className="text-h1 font-semibold tracking-tight text-primary">
                Заголовок страницы
              </p>
              <p className="text-meta text-muted">H1 48/54 → 32/36</p>
            </div>
            <div>
              <p className="text-h2 font-semibold tracking-tight text-primary">
                Раздел платформы
              </p>
              <p className="text-meta text-muted">H2 36/42 → 28/32</p>
            </div>
            <div>
              <p className="text-h3 font-semibold tracking-tight text-primary">
                Технология или объект
              </p>
              <p className="text-meta text-muted">H3 24/30 → 22/28</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-body-lg leading-relaxed text-secondary">
                  Основной текст: оценка готовности технологии по ГОСТ Р
                  58048-2017 ведётся по четырём направлениям — научному,
                  техническому, организационному и производственному.
                </p>
                <p className="text-meta text-muted">Body large 20/30 → 18/27</p>
              </div>
              <div>
                <p className="text-body leading-relaxed text-secondary">
                  Текст по умолчанию: платформа показывает текущую готовность
                  технологии, доказательства за ней и следующий проверенный шаг.
                </p>
                <p className="mt-2 text-small leading-relaxed text-muted">
                  Вспомогательный текст и подписи: 14/20. Метаданные — только
                  в 12/16.
                </p>
                <p className="mt-2 font-mono text-meta text-muted">
                  ID записи: T-0042 · 2026-08-06 · версия 3
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Кнопки */}
        <Section
          id="buttons"
          title="Кнопки"
          intro="Иерархии: primary (одно главное действие), secondary, quiet и destructive. Радиус 8 px, фокус видимый, disabled различим."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Подать технологию
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Подать технологию
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Открыть технологию
            </button>
            <button
              type="button"
              disabled
              className="inline-flex h-11 items-center rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Открыть технологию
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Запросить уточнение
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-control border border-status-danger bg-transparent px-5 text-small font-medium text-status-danger transition-colors hover:bg-status-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Отклонить заявку
            </button>
          </div>
          <p className="mt-3 text-meta text-muted">
            Таб-клавишами — проверьте видимое кольцо фокуса во всех трёх темах.
          </p>
        </Section>

        {/* Статусы */}
        <Section
          id="statuses"
          title="Статусы"
          intro="Семантика одинакова во всех темах: успех, предупреждение, ошибка, информация, черновик. Всегда иконка + текст, цвет — не единственный канал."
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge kind="success" label="Проверено" />
            <StatusBadge kind="warning" label="Требует уточнения" />
            <StatusBadge kind="danger" label="Отклонено" />
            <StatusBadge kind="info" label="На проверке" />
            <StatusBadge kind="draft" label="Черновик" />
          </div>
        </Section>

        {/* Таблица */}
        <Section
          id="table"
          title="Реестр исследований и разработок (НИОКТР)"
          intro="Реальные записи из реестра НИОКТР (источник: МИНОБРНАУКИ России). Компактная строка, моноширинный номер регистрации, исполнитель и год — образец будущих реестров платформы."
        >
          <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle bg-canvas/60">
                  <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">
                    Номер регистрации
                  </th>
                  <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">
                    Название
                  </th>
                  <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">
                    Исполнитель
                  </th>
                  <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">
                    Год
                  </th>
                  <th scope="col" className="px-4 py-3 text-meta font-medium text-muted">
                    Источник
                  </th>
                </tr>
              </thead>
              <tbody>
                {demoRows.map((row) => (
                  <tr
                    key={row.registration_number}
                    className="border-b border-border-subtle last:border-0 hover:bg-accent-soft/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-meta text-muted">
                      {row.registration_number}
                    </td>
                    <td className="px-4 py-3.5 text-small font-medium leading-snug text-primary">
                      {row.name}
                    </td>
                    <td className="px-4 py-3.5 text-small text-secondary">
                      {row.executor}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-meta text-secondary">
                      {row.year}
                      {row.is_ai_area ? (
                        <span className="ml-2 rounded-[6px] bg-accent-soft px-1.5 py-0.5 font-sans text-meta font-medium text-accent">
                          ИИ
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <StatusBadge kind="info" label="МИНОБРНАУКИ России" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Форма */}
        <Section
          id="form"
          title="Форма"
          intro="Поля с подписями, фокус видимый во всех темах, disabled-состояния различимы. Прогрессивное раскрытие — на этапе T-005."
        >
          <form
            className="grid max-w-2xl gap-5 rounded-panel border border-border-subtle bg-surface p-6"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="t-name"
                  className="text-small font-medium text-primary"
                >
                  Название технологии
                </label>
                <input
                  id="t-name"
                  name="name"
                  type="text"
                  placeholder="Например, композит на основе льняного волокна"
                  className="h-11 rounded-control border border-border-strong bg-canvas px-3 text-small text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="t-industry"
                  className="text-small font-medium text-primary"
                >
                  Отрасль
                </label>
                <select
                  id="t-industry"
                  name="industry"
                  className="h-11 rounded-control border border-border-strong bg-canvas px-3 text-small text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <option>Машиностроение</option>
                  <option>Агропромышленный комплекс</option>
                  <option>ИТ и связь</option>
                  <option>Материалы и химия</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="t-desc"
                className="text-small font-medium text-primary"
              >
                Описание решения
              </label>
              <textarea
                id="t-desc"
                name="description"
                rows={3}
                placeholder="Проблема, решение, текущий результат проверки"
                className="rounded-control border border-border-strong bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="t-created"
                className="text-small font-medium text-primary"
              >
                Дата создания
              </label>
              <input
                id="t-created"
                name="created"
                type="text"
                value="2026-08-06"
                disabled
                className="h-11 rounded-control border border-border-strong bg-canvas px-3 text-small text-primary"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Отправить заявку
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center rounded-control px-4 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Сохранить черновик
              </button>
            </div>
          </form>
        </Section>

        {/* УГТ-шкала */}
        <Section
          id="ugt"
          title="Шкала готовности технологии"
          intro="Низкая готовность 1–3, средняя 4–6, высокая 7–9. Число, подпись и форма маркера — цвет не единственный канал. В удмуртской теме маркеры становятся восьмиконечными звёздами."
        >
          <div className="rounded-panel border border-border-subtle bg-surface p-6">
            <div className="flex flex-wrap items-center gap-2">
              {UGT_LEVELS.map((item) => (
                <div
                  key={item.level}
                  className="flex w-[68px] flex-col items-center gap-1.5"
                >
                  <span
                    className="ugt-marker"
                    style={{ color: UGT_LEVEL_COLORS[item.level - 1] }}
                  >
                    <span className="sr-only">Уровень {item.level}</span>
                  </span>
                  <span
                    className="font-mono text-body font-semibold"
                    style={{ color: UGT_LEVEL_COLORS[item.level - 1] }}
                  >
                    {item.level}
                  </span>
                  <span className="text-center text-meta leading-tight text-muted">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-small font-medium text-primary">
                  Путь технологии: УГТ 5 из 9
                </p>
                <p className="font-mono text-meta text-muted">Прототип · проверка завершена</p>
              </div>
              <div
                className="ugt-track mt-2"
                role="progressbar"
                aria-valuenow={5}
                aria-valuemin={1}
                aria-valuemax={9}
                aria-label="Готовность технологии: уровень 5 из 9"
              >
                <div className="ugt-track-fill" style={{ width: `${(5 / 9) * 100}%` }} />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-control bg-ugt-low-soft p-3">
                <FlaskConical className="h-5 w-5 shrink-0 text-ugt-low" aria-hidden />
                <div>
                  <p className="text-small font-medium text-ugt-low">Низкая · 1–3</p>
                  <p className="text-meta text-secondary">
                    Идея, концепция, лабораторные исследования
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-control bg-ugt-medium-soft p-3">
                <Building2 className="h-5 w-5 shrink-0 text-ugt-medium" aria-hidden />
                <div>
                  <p className="text-small font-medium text-ugt-medium">Средняя · 4–6</p>
                  <p className="text-meta text-secondary">
                    Макет, прототип, пилотное внедрение
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-control bg-ugt-high-soft p-3">
                <Factory className="h-5 w-5 shrink-0 text-ugt-high" aria-hidden />
                <div>
                  <p className="text-small font-medium text-ugt-high">Высокая · 7–9</p>
                  <p className="text-meta text-secondary">
                    Опытный образец, серия 0, производство
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Примечание */}
        <div className="mt-12 rounded-panel border border-border-subtle bg-surface p-6">
          <p className="text-small font-medium text-primary">
            Контраст и доступность
          </p>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Токены проверены на WCAG AA: основной текст на холсте ≥ 4.5:1,
            белый на акцентной заливке ≥ 4.5:1 во всех трёх темах. Статусы
            передаются цветом и текстом. Включите prefers-reduced-motion —
            переходы отключаются. Удмуртский характер — модульная геометрия
            восьмиконечной звезды в разделителях и маркерах, без флага на
            каждом экране.
          </p>
        </div>
      </div>
    </div>
  );
}
